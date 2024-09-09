import { ActionOrBust, ConfigLoader, LookupWrapper, OperationFactory, PrefixOpts } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

@injectable()
export class SpsActionOrBust extends ActionOrBust {
    public constructor(@inject(LookupWrapper) lookupWrapper: LookupWrapper) {
        super(lookupWrapper);
    }
}

@injectable()
export class SpsOperationFactory extends OperationFactory {
    public constructor(@inject(ActionOrBust) actionOrBust: ActionOrBust, @inject(ConfigLoader) configLoader: ConfigLoader, @inject(PrefixOpts) cfg: PrefixOpts) {
        super(actionOrBust, configLoader, cfg);
    }
}
