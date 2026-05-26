declare module "howler" {
  export interface HowlOptions {
    src: string | string[]
    volume?: number
    preload?: boolean
    html5?: boolean
    format?: string[]
  }

  export class Howl {
    constructor(options: HowlOptions)
    play(): number
    stop(): this
    unload(): this
  }

  export const Howler: {
    ctx: AudioContext | undefined
  }
}
