import fetch from 'node-fetch'
import Log from '../src/logger'

jest.mock('node-fetch', () => ({
  __esModule: true,
  default: jest.fn()
}))

const mockFetch = fetch as unknown as jest.Mock

test('sends correct payload and headers', async () => {
  process.env.LOG_SERVICE_TOKEN = 'test-token'
  mockFetch.mockResolvedValue({json: async () => ({logID: '1', message: 'log created successfully'})})
  const res = await Log('backend','error','handler','received string')
  expect(mockFetch).toHaveBeenCalledWith('http://4.224.186.213/evaluation-service/logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-token'
    },
    body: JSON.stringify({stack: 'backend', level: 'error', package: 'handler', message: 'received string'})
  })
  expect(res).toEqual({logID: '1', message: 'log created successfully'})
})
