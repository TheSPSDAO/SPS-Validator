import { Lifecycle, injectAll, scoped, Disposable } from 'tsyringe';

export const ManualDisposable: unique symbol = Symbol('ManualDisposable');
type ManualDisposable = Disposable;

/**
 * A class that tracks disposables that were registered with useValue, but still need to be disposed at the end of the container's lifecycle.
 */
@scoped(Lifecycle.ContainerScoped)
export class ManualDisposer implements Disposable {
    constructor(@injectAll(ManualDisposable) private readonly disposables: ManualDisposable[]) {}

    dispose() {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }
}
