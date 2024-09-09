import { Knex } from 'knex';
import { instanceCachingFactory } from 'tsyringe';
import { Backup, FreshDatabase, TestWrapper } from './fake-db';
import { Disposable } from './disposable';
import { CompositionRoot, container } from '../sps/composition-root';
import { HardcodedValidatorShop } from './shop/hardcoded-shop';
import { ConditionalApiActivator, KnexToken, Middleware } from '@steem-monsters/splinterlands-validator';
import { DefaultMiddleware } from '../sps/api';
import { ValidatorShop } from '../sps/utilities/validator-shop';
import cfg, { ConfigType } from '../sps/convict-config';

class _TestCompositionRoot extends null {
    static {
        container.register<Backup>(Backup, { useToken: FreshDatabase });
        container.register<Disposable>(Disposable, { useToken: FreshDatabase });
        container.register<TestWrapper>(TestWrapper, { useToken: FreshDatabase });
        container.register<Knex>(KnexToken, {
            useFactory: instanceCachingFactory((c) => {
                const fakeDb = c.resolve<FreshDatabase>(FreshDatabase);
                return fakeDb.knex;
            }),
        });

        container.register<Middleware>(Middleware, {
            useFactory: instanceCachingFactory((c) => c.resolve<Middleware>(DefaultMiddleware)),
        });

        container.register<ConditionalApiActivator>(ConditionalApiActivator, {
            useValue: {
                perhapsEnableApi: function () {
                    // TODO: dummy
                },
            },
        });

        // Socket
        container.register<ConfigType>(ConfigType, {
            useValue: {
                ...cfg,
                // disable socket even if set in env file.
                socket_url: null as unknown as string,
            },
        });

        container.register<ValidatorShop>(ValidatorShop, { useToken: HardcodedValidatorShop });
        CompositionRoot.assertValidRegistry();
    }
}

export { container } from '../sps/composition-root';
