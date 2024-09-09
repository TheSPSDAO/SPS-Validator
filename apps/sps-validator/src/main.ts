import '@abraham/reflection';
import { EntryPoint } from '@steem-monsters/splinterlands-validator';
import { CompositionRoot, container } from './sps/composition-root';

async function start(): Promise<void> {
    CompositionRoot.assertValidRegistry();
    const ep = container.resolve(EntryPoint);
    await ep.preflightCheck();
    await ep.start();
}

if (require.main === module) {
    start();
}
