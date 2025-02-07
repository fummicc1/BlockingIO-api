import * as dotenv from 'dotenv';
import express from 'express';
import swaggerUI from 'swagger-ui-express';
import * as docs from './routes/docs';
import * as config from './config/config';
import {
    EventRegistration,
    SocketIOController,
} from './infrastructure/socketIOController';
import * as socketio from 'socket.io';
import { createServer } from 'http';
import { IUserService, UserService } from './application/services/userService';
import {
    joinRoomEvent,
    requestAfterGameEvent,
    setupUidEvent,
} from './routes/socketEvents';
import {
    onConnectionEvent,
    onDisconnectEvent,
    onJoinRoomEvent,
    onRequestAfterGameEvent,
    onSetupUidEvent,
} from './routes/socketEventsHandler';
import {
    IUserRepository,
    UserRepository,
} from './application/repositories/userRepository';
import {
    IRoomRepository,
    RoomRepository,
} from './application/repositories/roomRepository';
import { GameService, IGameService } from './application/services/gameService';

// .envから環境変数を読み込み
dotenv.config();

const app = express();

app.use('/static', express.static('./test-client/public'));

const documentText = docs.document;
const documentJson = JSON.parse(documentText);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(documentJson));

const httpServer = createServer(app);
const io = new socketio.Server(httpServer);
const socketIOController = new SocketIOController(io);
const userRepository: IUserRepository = new UserRepository();
const roomRepository: IRoomRepository = new RoomRepository();
const userService: IUserService = new UserService(
    socketIOController,
    userRepository,
    roomRepository
);
const gameService: IGameService = new GameService(socketIOController);

export { userRepository, userService, gameService };

socketIOController.onConnection((socket) => {
    console.log('Connection ok');
    onConnectionEvent(socket);

    socketIOController.onDisconnect(socket, () => {
        console.log('disconnect');
        onDisconnectEvent(socket);
    });

    const onSetupUidRegistration: EventRegistration<string> = {
        event: setupUidEvent,
        handler: async (uid) => {
            await onSetupUidEvent(socket, uid);
        },
    };
    socketIOController.register(socket, onSetupUidRegistration);

    const joinRoomRegistration: EventRegistration<void> = {
        event: joinRoomEvent,
        handler: async () => {
            await onJoinRoomEvent(socket.id);
        },
    };
    socketIOController.register(socket, joinRoomRegistration);

    socketIOController.register<'restart' | 'leave'>(socket, {
        event: requestAfterGameEvent,
        handler: async (action) => {
            await onRequestAfterGameEvent(socket.id, action);
        },
    });
});

httpServer.listen(config.PORT, () => {
    console.log('Server starts on', config.PORT);
});
