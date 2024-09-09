export type ExtractParamsType<A> = A extends { readonly params: infer T } ? T : never;
