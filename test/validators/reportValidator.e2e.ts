import { browser } from '@wdio/globals'
import fs from 'node:fs'
import path from 'node:path'
import allure from 'allure-commandline'
import httpServer from 'http-server'
import type { Server as HttpServer } from 'node:http'
import type { AddressInfo, Socket } from 'node:net'

type StaticServerInstance = ReturnType<typeof httpServer.createServer> & {
  server: HttpServer
}

let baseUrl = ''
const reportDir = 'allure-report'
const casesDir = path.join(reportDir, 'data', 'test-cases')
const singleFileIndex = path.join(reportDir, 'index.html')
let cachedCases: Array<{ uid: string; name: string }> | null = null
let caseDetails: Map<string, any> | null = null
let staticServer: StaticServerInstance | null = null
const activeSockets = new Set<Socket>()

const clickAll = async (selector: string): Promise<void> => {
  const elements = await $$(selector)
  for (const element of elements) {
    try {
      if (await element.isDisplayed()) {
        await element.click()
      }
    } catch {
      // ignore elements that cannot be interacted with
    }
  }
}

const expandAllSections = async (): Promise<void> => {
  await clickAll('div.status-details__trace-toggle')
  await clickAll('div.collapsible__header .collapsible__toggle')
  await clickAll('.step__title .angle.fa-angle-right')
}

const generateAllureReport = async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const proc = allure(['generate', '--clean', '--single-file', 'allure-results', '-o', reportDir])
    proc.on('exit', (code: number | null) => code === 0 ? resolve() : reject(new Error(`allure generate exited ${code}`)))
    proc.on('error', reject)
  })
}

const startStaticServer = async (): Promise<void> => {
  activeSockets.clear()
  staticServer = httpServer.createServer({ root: reportDir, cache: -1 }) as StaticServerInstance
  staticServer.server.on('connection', onServerConnection)
  await new Promise<void>((resolve) => staticServer!.listen(0, '127.0.0.1', resolve))
  const info = staticServer!.server.address()
  if (!info || typeof info === 'string') throw new Error('Failed to start http-server (unknown address)')
  baseUrl = `http://127.0.0.1:${info.port}/`
}

const onServerConnection = (socket: Socket): void => {
  activeSockets.add(socket)
  socket.on('close', () => activeSockets.delete(socket))
}

const loadTestCases = (): Array<{ uid: string; name: string }> => {
  if (cachedCases && caseDetails) return cachedCases

  caseDetails = new Map()

  if (fs.existsSync(casesDir)) {
    cachedCases = fs.readdirSync(casesDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const data = JSON.parse(fs.readFileSync(path.join(casesDir, file), 'utf8'))
        caseDetails!.set(data.uid, data)
        return { uid: data.uid, name: data.name }
      })
  } else if (fs.existsSync(singleFileIndex)) {
    const html = fs.readFileSync(singleFileIndex, 'utf8')
    const regex = /d\(['"]data\/test-cases\/([^'"]+)['"],\s*['"]([^'"]+)['"]\)/g
    const cases: Array<{ uid: string; name: string }> = []
    let match: RegExpExecArray | null
    while ((match = regex.exec(html)) !== null) {
      const [, fileName = '', encoded = ''] = match
      const payload = Buffer.from(encoded.replace(/\s+/g, ''), 'base64').toString('utf8')
      const data = JSON.parse(payload)
      const uid = data.uid ?? path.basename(fileName, '.json')
      caseDetails!.set(uid, data)
      cases.push({ uid, name: data.name })
    }
    cachedCases = cases
  } else {
    throw new Error('Missing allure-report output (expected index.html). Run the specs first.')
  }

  if (!cachedCases.length) {
    throw new Error('No test cases found in Allure report output')
  }

  return cachedCases
}

const getTestCase = (uid: string): any => {
  if (!caseDetails) loadTestCases()
  const data = caseDetails?.get(uid)
  if (!data) throw new Error(`Missing test case data for uid ${uid}`)
  return data
}

const collectStepNames = (testCase: any): string[] => {
  const directSteps = Array.isArray(testCase.steps) ? testCase.steps : []
  const testStageSteps = Array.isArray(testCase.testStage?.steps) ? testCase.testStage.steps : []
  return [...directSteps, ...testStageSteps]
    .map((step: any) => typeof step?.name === 'string' ? step.name : '')
    .filter(Boolean)
}

const hasGlobalSetupEvidence = (testCase: any): boolean => {
  const names = collectStepNames(testCase)
  return names.includes('Global setup step 1: Navigate') && names.includes('Global setup step 2: Screenshot')
}

const uidFor = (name: string, predicate?: (testCase: any) => boolean): string => {
  const matches = loadTestCases().filter(testCase => testCase.name === name)
  if (matches.length === 0) {
    const available = loadTestCases().map(testCase => testCase.name)
    throw new Error(`Missing report entry for "${name}". Available: ${available.join(', ')}`)
  }
  for (const match of matches) {
    const data = getTestCase(match.uid)
    if (!predicate || predicate(data)) return match.uid
  }
  throw new Error(`Found ${matches.length} entries for "${name}" but none satisfied predicate.`)
}

describe('Allure Report Validator', () => {
  before(async function () {
    this.timeout(60000)
    await generateAllureReport()
    await startStaticServer()
    fs.mkdirSync('screenshots', { recursive: true })
    if (!fs.existsSync(singleFileIndex)) throw new Error('Missing allure-report/index.html - run specs first')
    loadTestCases()
  })

  after(async function () {
    if (browser.sessionId) {
      await browser.url('about:blank')
    }
    if (staticServer) {
      for (const socket of activeSockets) {
        try {
          socket.destroy()
        } catch {
          // ignore errors from force-closing sockets
        }
      }
      activeSockets.clear()
      await new Promise<void>((resolve, reject) => {
        staticServer!.server.close((err?: Error) => err ? reject(err) : resolve())
      })
      staticServer = null
    }
  })

  it('shows global setup evidence on the first passing test', async () => {
    await browser.url(`${baseUrl}#testresult/${uidFor('test should run successfully')}`)
    await $('div.test-result__content, div.test-case__content, section.test-result, section.test-case')
    await expandAllSections()
    await expect($("//*[contains(normalize-space(.), 'Global setup step 1: Navigate')]")).toBeExisting()
    await expect($("//*[contains(normalize-space(.), 'Global setup step 2: Screenshot')]")).toBeExisting()
    await browser.saveScreenshot('screenshots/global_setup_success.png')
  })

  it('records a synthetic test when mochaGlobalSetup fails', async () => {
    const uid = uidFor('Global fixture failure', hasGlobalSetupEvidence)
    await browser.url(`${baseUrl}#testresult/${uid}`)
    await $('div.test-result__content, div.test-case__content, section.test-result, section.test-case')
    await expandAllSections()
    const data = getTestCase(uid)
    const stepNames = collectStepNames(data)
    expect(stepNames).toEqual(expect.arrayContaining(['Global setup step 1: Navigate', 'Global setup step 2: Screenshot']))
    await expect($("//*[contains(normalize-space(.), 'Console Output')]")).toBeExisting()
    await browser.saveScreenshot('screenshots/global_fixture_failure.png')
  })

  it('shows nested beforeAll screenshot evidence on suite-level failure', async () => {
    await browser.url(`${baseUrl}#testresult/${uidFor('Scenario 4: Suite-level failure: beforeAll hook failure')}`)
    await $('div.test-result__content, div.test-case__content, section.test-result, section.test-case')
    await expandAllSections()
    await expect($("//*[contains(normalize-space(.), 'Suite setup step')]")).toBeExisting()
    await expect($("//*[contains(normalize-space(.), 'Suite setup screenshot')]")).toBeExisting()
    await expect($("//*[contains(normalize-space(.), 'Hook Console Logs')]")).toBeExisting()
    await browser.saveScreenshot('screenshots/suite_beforeAll_failure.png')
  })

  it('captures root hook failure evidence', async () => {
    await browser.url(`${baseUrl}#testresult/${uidFor('(root): beforeAll hook failure')}`)
    await $('div.test-result__content, div.test-case__content, section.test-result, section.test-case')
    await expandAllSections()
    await expect($("//*[contains(normalize-space(.), 'Hook Console Logs')]")).toBeExisting()
    await browser.saveScreenshot('screenshots/root_beforeAll_failure.png')
  })
})
