declare module 'bwip-js' {
  interface BwipOptions {
    bcid:          string
    text:          string
    scale?:        number
    height?:       number
    width?:        number
    columns?:      number
    eclevel?:      number
    includetext?:  boolean
    textxalign?:   string
    [key: string]: unknown
  }

  function toBuffer(options: BwipOptions): Promise<Buffer>
  function toCanvas(canvas: unknown, options: BwipOptions): Promise<unknown>

  export { toBuffer, toCanvas }
}
