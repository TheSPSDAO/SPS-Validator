import { Plugin, PluginDispatcherBuilder } from './plugin';

describe('plugin', () => {
    let mockPlugin: Plugin;

    beforeAll(() => {
        mockPlugin = {
            name: 'Test Plugin',
            onBlockProcessed: jest.fn().mockResolvedValue(undefined),
        };
    });

    beforeEach(() => {
        (mockPlugin.onBlockProcessed as jest.Mock).mockClear();
    });

    test('Plugin gets data dispatched', () => {
        const dispatcher = PluginDispatcherBuilder.create().addPlugin(mockPlugin).build();

        dispatcher.dispatch(1, [], '', 1);

        expect(mockPlugin.onBlockProcessed).toBeCalledTimes(1);
    });
});
