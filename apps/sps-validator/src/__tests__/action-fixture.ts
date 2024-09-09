import { autoInjectable, inject } from 'tsyringe';
import { Fixture as BaseFixture } from './fixture';
import { ConfigType } from '../sps/convict-config';
import { SpsConfigLoader } from '../sps/config';

@autoInjectable()
export class Fixture extends BaseFixture {
    readonly loader: SpsConfigLoader;
    readonly cfg: ConfigType;
    constructor(@inject(SpsConfigLoader) loader?: SpsConfigLoader, @inject(ConfigType) cfg?: ConfigType) {
        super();
        this.loader = loader!;
        this.cfg = cfg!;
    }
}
