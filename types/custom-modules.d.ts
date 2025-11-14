declare module 'allure-commandline' {
  import type { ChildProcess } from 'child_process'
  function allure(args?: string[]): ChildProcess
  export = allure
}
