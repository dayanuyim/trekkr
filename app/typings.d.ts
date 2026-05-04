declare module "*.json" {
    const value: any;
    export default value;
}

declare module "*.css" {
    const value: any;
    export default value;
}

interface Uint8Array {
    toBase64(): string;
}

interface Uint8ArrayConstructor {
    fromBase64(base64: string): Uint8Array;
}
