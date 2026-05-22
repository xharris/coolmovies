declare module "vanta" {
  export type VantaOptions = {
    el: HTMLElement | string
  } & Record<string, unknown>

  export type VantaEffect = {
    destroy: () => void
    resize?: () => void
    setOptions?: (options: Record<string, unknown>) => void
  }

  export type VantaFactory = (options: VantaOptions) => VantaEffect

  const vanta: Record<string, VantaFactory>
  export default vanta
}

declare module "vanta/dist/*" {
  type VantaOptions = {
    el: HTMLElement | string
  } & Record<string, unknown>

  type VantaEffect = {
    destroy: () => void
    resize?: () => void
    setOptions?: (options: Record<string, unknown>) => void
  }

  const effectFactory: (options: VantaOptions) => VantaEffect
  export default effectFactory
}
