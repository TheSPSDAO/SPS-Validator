import { EventEmitter } from 'events';

/*
Inspired by https://stackoverflow.com/questions/39142858/declaring-events-in-a-typescript-class-which-extends-eventemitter

Answer from: https://stackoverflow.com/users/4613569/sergeyk
Edited by: https://stackoverflow.com/users/4464702/randers
 */
export interface TypedEventEmitter<T> {
    on<K extends keyof T>(s: K, listener: (v: T[K]) => void): this;

    once<K extends keyof T>(s: K, listener: (v: T[K]) => void): this;

    emit<K extends keyof T>(s: K, arg: T[K]): boolean;
}

/*
BSD-3-Clause Copyright (c) 2017 Johan Nordberg
 */
export function waitForEvent<T>(emitter: TypedEventEmitter<T>, eventName: keyof T): Promise<T[keyof T]> {
    return new Promise((resolve) => {
        emitter.once(eventName, resolve);
    });
}

interface Events {
    enqueued: void;
    dequeued: void;
}

export class AsyncQueue<T> extends EventEmitter implements TypedEventEmitter<Events> {
    private readonly elements: T[];

    public constructor(private readonly size = 32) {
        super();
        this.elements = [];
    }

    /**
     * Enqueues an element to the queue, waits if there is no space left.
     * Function is not safe to be used in more than 1 coroutine.
     * @param element Element to queue.
     */
    public async enqueue(element: T): Promise<void> {
        if (this.elements.length >= this.size) {
            await waitForEvent(this, 'dequeued');
        }

        this.elements.push(element);
        this.emit('enqueued');
    }

    /**
     * Dequeues an element from the queue, waits if there is no element to dequeue.
     *
     * Function is not safe to be used in more than 1 coroutine.
     */
    public async dequeue(): Promise<T> {
        if (this.isEmpty) {
            await waitForEvent(this, 'enqueued');
            console.assert(this.elements.length > 0, 'Attempting to dequeue AsyncQueue with a list length of 0 or less');
        }

        const element = this.elements.shift()!;
        this.emit('dequeued');
        return element;
    }

    public get length() {
        return this.elements.length;
    }

    public get isEmpty() {
        return this.elements.length === 0;
    }

    public get free() {
        return this.size - this.elements.length;
    }
}
