import test from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from './app.js'

test('health check should return ok', async () => {
  const response = await request(app).get('/api/health')
  assert.equal(response.status, 200)
  assert.equal(response.body.ok, true)
})

test('analyze should validate request body', async () => {
  const response = await request(app).post('/api/hotspots/analyze').send({})
  assert.equal(response.status, 400)
})

test('platform hotspots snapshot should return schedule', async () => {
  const response = await request(app).get('/api/platform-hotspots')
  assert.equal(response.status, 200)
  assert.equal(typeof response.body.schedule.intervalMinutes, 'number')
  assert.equal(Array.isArray(response.body.options), true)
})

test('platform schedule should reject invalid interval', async () => {
  const response = await request(app).post('/api/platform-hotspots/schedule').send({ intervalMinutes: 0 })
  assert.equal(response.status, 400)
})

test('platform schedule should accept keyword and selected platforms', async () => {
  const response = await request(app)
    .post('/api/platform-hotspots/schedule')
    .send({ keywords: ['AI', '手机'], selectedPlatforms: ['weibo', 'bilibili'], intervalMinutes: 5 })
  assert.equal(response.status, 200)
  assert.deepEqual(response.body.schedule.keywords, ['AI', '手机'])
  assert.deepEqual(response.body.schedule.selectedPlatforms, ['weibo', 'bilibili'])
})
