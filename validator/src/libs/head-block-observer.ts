import { EventEmitter } from 'events';
import { TypedEventEmitter } from './async-queue';
import * as utils from '../utils';
import { LogLevel } from '../utils';

interface HeadBlockObserverEvents {
    updated: number;
}

export class HeadBlockObserver extends EventEmitter implements TypedEventEmitter<HeadBlockObserverEvents> {
    public set headBlockNum(value: number) {
        // I guess this could happen if the head streaming swapped to another node?
        if (value < this._headBlockNum) {
            utils.log(`Attempted to go back in time, setting headBlockNum from ${this._headBlockNum} to ${value}`, LogLevel.Error);
            return;
        } else if (value > this._headBlockNum) {
            this._headBlockNum = value;
            this.emit('updated', value);
        }
        // Ignore duplicate block numbers
    }

    public get headBlockNum(): number {
        return this._headBlockNum;
    }

    public constructor(private _headBlockNum: number) {
        super();
    }
}
