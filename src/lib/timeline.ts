import { v4 as uuid } from 'uuid';

// const uuid = (() => {
//     let id = 1;
//     return () => `ID_${id++}`;
// })();

export class BranchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BranchError';
    }
}

export class TransformationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TransformationError';
    }
}

interface ITransformationError {
    id: Id;
    message: string;
}

type Id = string;
type OmitFirstArg<T> = T extends (first: any, ...args: infer P) => infer R ? Parameters<(...args: P) => R> : never;

type InputState<T extends Transformations<T>> = Awaited<ReturnType<T[keyof T]>>;
type OutputState<T extends Transformations<T>> = InputState<T> | Promise<InputState<T>>;
type Transformations<T extends { [key: string]: (first: InputState<T>, ...args: any) => OutputState<T> }> = { [key: string]: (first: InputState<T>, ...args: any) => OutputState<T> };

interface IState<T extends Transformations<T>, K extends keyof T> {
    type: K;
    args: OmitFirstArg<T[K]>;
    parent: Id;
    children: Id[];
}

type States<T extends Transformations<T>> = Map<Id, IState<T, keyof T>>;
type Cache<T extends Transformations<T>> = Map<Id, InputState<T>>;

interface IBranchResult<T extends Transformations<T>> {
    apply: () => Id;
    ok: (callback: (id: Id, states: States<T>, cache: Cache<T>, apply: () => void) => void) => this;
    transformationError: (callback: (id: Id, states: States<T>, cache: Cache<T>, errors: ITransformationError[]) => void) => this;
    branchError: (callback: (message: string) => void) => this;
}

interface IEditResult<T extends Transformations<T>> {
    apply: () => void;
    ok: (callback: (states: States<T>, cache: Cache<T>, apply: () => void) => void) => this;
    transformationError: (callback: (states: States<T>, cache: Cache<T>, errors: ITransformationError[]) => void) => this;
    branchError: (callback: (message: string) => void) => this;
}

interface IRemoveResult<T extends Transformations<T>> {
    apply: () => void;
    ok: (callback: (states: States<T>, cache: Cache<T>, apply: () => void) => void) => this;
}

export class Timeline<T extends Transformations<T>> {
    private transformations: T;
    private states: States<T> = new Map();
    private cache: Cache<T> = new Map();

    constructor(transformations: T, createInitial: () => InputState<T>) {
        this.transformations = transformations;
        this.cache.set('initial', createInitial());
    }

    public getStates(): States<T> {
        return this.states;
    }

    public getCache(): Cache<T> {
        return this.cache;
    }

    public async branch<K extends keyof T>(id: Id, type: K, ...args: OmitFirstArg<T[K]>): Promise<IBranchResult<T>> {
        if (id !== 'initial' && !this.states.has(id))
            return {
                apply: function () {
                    throw new BranchError(`State '${id}' does not exist`);
                },
                ok: function (callback) {
                    return this;
                },
                transformationError: function (callback) {
                    return this;
                },
                branchError: function (callback) {
                    callback(`State '${id}' does not exist`);
                    return this;
                },
            } as IBranchResult<T>;

        const states = structuredClone(this.states);
        const cache = structuredClone(this.cache);

        const newId = uuid();

        states.set(newId, {
            type, args,
            parent: id,
            children: []
        });

        if (id !== 'initial')
            states.get(id)!.children.push(newId);

        const errors = await run(this.transformations, newId, states, cache);

        if (errors.length > 0) {
            return {
                apply: function () {
                    throw new BranchError(`Branching from '${id}' resulted in following errors: ${errors.map((error) => `'${error.message}' at '${error.id}'`)}`);
                },
                ok: function (callback) {
                    return this;
                },
                transformationError (callback) {
                    callback(newId, states, cache, errors);
                    return this;
                },
                branchError (callback) {
                    return this;
                }
            } as IBranchResult<T>;
        }

        const applicator = () => {
            this.states = states;
            this.cache = cache;
        };

        return {
            apply: function () {
                applicator();
                return newId;
            },
            ok: function (callback) {
                callback(newId, states, cache, applicator)
                return this;
            },
            transformationError (callback) {
                return this;
            },
            branchError (callback) {
                return this;
            }
        } as IBranchResult<T>;
    }

    public async edit<K extends keyof T>(id: Id, type: K, ...args: OmitFirstArg<T[K]>): Promise<IEditResult<T>> {
        if (!this.states.has(id))
            return {
                apply: function () {
                    throw new BranchError(`State '${id}' does not exist`);
                },
                ok: function (callback) {
                    return this;
                },
                transformationError: function (callback) {
                    return this;
                },
                branchError: function (callback) {
                    callback(`State '${id}' does not exist`);
                    return this;
                },
            } as IEditResult<T>;

        const states = structuredClone(this.states);
        const cache = structuredClone(this.cache);

        const state = states.get(id)!;
        state.type = type;
        state.args = args;

        const errors = await run(this.transformations, id, states, cache);

        if (errors.length > 0) {
            return {
                apply: function () {
                    throw new BranchError(`Editing '${id}' resulted in following errors: ${errors.map((error) => `'${error.message}' at '${error.id}'`)}`);
                },
                ok: function (callback) {
                    return this;
                },
                transformationError (callback) {
                    callback(states, cache, errors);
                    return this;
                },
                branchError (callback) {
                    return this;
                }
            } as IEditResult<T>;
        }

        const applicator = () => {
            this.states = states;
            this.cache = cache;
        };

        return {
            apply: function () {
                applicator();
            },
            ok: function (callback) {
                callback(states, cache, applicator)
                return this;
            },
            transformationError (callback) {
                return this;
            },
            branchError (callback) {
                return this;
            }
        } as IEditResult<T>;
    }

    public remove(id: Id): IRemoveResult<T> {
        if (!this.states.has(id))
            return {
                apply: function () {
                    throw new BranchError(`State '${id}' does not exist`);
                },
                ok: function (callback) {
                    return this;
                }
            } as IRemoveResult<T>;

        const states = structuredClone(this.states);
        const cache = structuredClone(this.cache);

        const state = states.get(id)!;

        if (state.parent !== 'initial') {
            const parent = states.get(state.parent)!;
            const idx = parent.children.indexOf(id);
            parent.children.splice(idx, 1);
        }

        const queue = [id];

        for (const id of queue) {
            const state = states.get(id)!;
            queue.push(...state.children);
            states.delete(id);
            cache.delete(id);
        }

        const applicator = () => {
            this.states = states;
            this.cache = cache;
        };

        return {
            apply: function () {
                applicator();
            },
            ok: function (callback) {
                callback(states, cache, applicator)
                return this;
            }
        } as IRemoveResult<T>;
    }
}

interface CacheWithRelatives<T extends Transformations<T>> {
    data: ReturnType<T[keyof T]>;
    parent: Id | null;
    children: Id[];
}

interface CacheAsTree<T extends Transformations<T>> {
    id: Id;
    data: ReturnType<T[keyof T]>;
    parent: CacheAsTree<T> | null;
    children: CacheAsTree<T>[];
}

export function cacheToCacheWithRelatives<T extends Transformations<T>>(states: States<T>, cache: Cache<T>): Map<Id, CacheWithRelatives<T>> {
    const mapped = [...cache.entries()].map(([k, v]) => [k, {
        data: v,
        parent: k === 'initial' ? null : states.get(k)!.parent,
        children: k === 'initial' ? [...states.entries()].filter(([k, v]) => v.parent === 'initial').map(([k, v]) => k) : states.get(k)!.children
    }]) as [Id, CacheWithRelatives<T>][];

    return new Map(mapped);
}

export function cacheToCacheAsTree<T extends Transformations<T>>(states: States<T>, cache: Cache<T>): CacheAsTree<T> {
    const nodes: Map<Id, CacheAsTree<T>> = new Map([['initial', {
        id: 'initial',
        data: cache.get('initial')!,
        parent: null,
        children: []
    }]]);

    const queue = [...states.entries()].filter(([k, v]) => v.parent === 'initial').map(([k, v]) => k);

    for (const id of queue) {
        const state = states.get(id)!;
        queue.push(...state.children);

        const parent = nodes.get(state.parent)!;

        const node: CacheAsTree<T> = {
            id,
            data: cache.get(id)!,
            parent,
            children: []
        };

        nodes.set(id, node);

        parent.children.push(node);
    }

    return nodes.get('initial')!;
}

async function run<T extends Transformations<T>>(transformations: T, start: Id, states: States<T>, cache: Cache<T>): Promise<ITransformationError[]> {
    const errors: ITransformationError[] = [];
    const queue = start === 'initial' ? [...states.entries()].filter(([k, v]) => v.parent === 'initial').map(([k, v]) => k) : [start];

    for (const id of queue) {
        const state = states.get(id)!;
        queue.push(...state.children);

        const input = structuredClone(cache.get(state.parent)!);

        try {
            const output = await transformations[state.type](input, ...state.args as any);
            cache.set(id, output);
        } catch(e) {
            if (e instanceof TransformationError) {
                errors.push({
                    id,
                    message: e.message
                });
            } else {
                throw e;
            }
        }
    }

    return errors;
}
