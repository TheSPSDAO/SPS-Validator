import { container } from '../__tests__/test-composition-root';
import { DelayedSocket, SocketLike, SocketWrapper } from '@steem-monsters/splinterlands-validator';

let socket: DelayedSocket;
let mock: SocketLike;
beforeAll(() => {
    const child = container.createChildContainer();
    mock = {
        send: jest.fn(),
        perhapsConnect: jest.fn(),
    };
    child.register<SocketLike>(SocketWrapper, { useValue: mock });
    socket = child.resolve<DelayedSocket>(DelayedSocket);
});

beforeEach(() => {
    (mock.send as jest.Mock).mockClear();
    (mock.perhapsConnect as jest.Mock).mockClear();
});

test('DelayedSocket does not send when there are no messages.', () => {
    expect(mock.send).not.toBeCalled();
    socket.sendDelayedBulk();
    expect(mock.send).not.toBeCalled();
});

test('DelayedSocket delays sending a message.', () => {
    socket.send('wordempire', '1', 'hello!');
    expect(mock.send).not.toBeCalled();
    socket.sendDelayedBulk();
    expect(mock.send).toBeCalledTimes(1);
});

test('DelayedSocket delays sending multiple message.', () => {
    socket.send('wordempire', '1x', 'hello!');
    expect(mock.send).not.toBeCalled();
    socket.send('wordempire', 'b2', 'anybody there?');
    expect(mock.send).not.toBeCalled();
    socket.send('wordempire', '3a', 'stop ignoring me!');
    expect(mock.send).not.toBeCalled();
    socket.sendDelayedBulk();
    expect(mock.send).toBeCalledTimes(3);
});

test('DelayedSocket only sends a message once.', () => {
    socket.send('wordempire', '1', 'hello!');
    expect(mock.send).not.toBeCalled();
    socket.sendDelayedBulk();
    expect(mock.send).toBeCalledTimes(1);
    socket.sendDelayedBulk();
    expect(mock.send).toBeCalledTimes(1);
});

test('DelayedSocket does not send cleared messages.', () => {
    socket.send('wordempire', '1', 'hello!');
    expect(mock.send).not.toBeCalled();
    socket.clearDelayed();
    socket.sendDelayedBulk();
    expect(mock.send).not.toBeCalled();
});

test('DelayedSocket forwards perhapsConnect.', () => {
    expect(mock.perhapsConnect).not.toBeCalled();
    socket.perhapsConnect();
    expect(mock.perhapsConnect).toBeCalledTimes(1);
});
