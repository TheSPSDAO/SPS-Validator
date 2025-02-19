import '@abraham/reflection';
import { EntryPoint } from '@steem-monsters/splinterlands-validator';
import { CompositionRoot, container } from './sps/composition-root';

async function start(): Promise<void> {
    try {
        CompositionRoot.assertValidRegistry();
        const ep = container.resolve(EntryPoint);
        await ep.preflightCheck();
        await ep.start();
    } catch (e) {
        console.error('Error while starting validator');
        console.error(e);
        process.exit(1);
    }
}

start();
