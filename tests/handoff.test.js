import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import SwaggerParser from '@apidevtools/swagger-parser';
import {generateMessages} from '@cucumber/gherkin';
import {IdGenerator, SourceMediaType} from '@cucumber/messages';
import {createMock} from '../gateway/mock.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/^\uFEFF/, '');

test('Handoff: OpenAPI hợp lệ, bản tương thích giống nhau, đủ 31 operation', async () => {
  const source = read('docs/api/openapi.yaml');
  assert.equal(source, read('api/openapi.yaml'));
  const spec = await SwaggerParser.validate(JSON.parse(source));
  assert.equal(Object.values(spec.paths).reduce((n, methods) => n + Object.keys(methods).length, 0), 31);
});

test('Handoff: đủ liên kết 20 FR, 11 NFR và 17 story có Gherkin chuẩn/ngoại lệ', () => {
  const srs = read('docs/SRS_v1.0.md');
  const rtm = read('docs/RTM.md');
  for (const [prefix, count] of [['FR', 20], ['NFR', 11]]) {
    for (let i = 1; i <= count; i++) {
      const id = `${prefix}-${String(i).padStart(2, '0')}`;
      assert.ok(srs.includes(`| ${id} |`), `SRS missing ${id}`);
      assert.ok(rtm.includes(`| ${id} |`), `RTM missing ${id}`);
    }
  }
  for (let i = 1; i <= 17; i++) {
    const name = `us-${String(i).padStart(2, '0')}.feature`;
    const envelopes = generateMessages(read('tests/features/' + name), name, SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN, {
      newId: IdGenerator.incrementing(), includeSource: false, includeGherkinDocument: true, includePickles: true
    });
    assert.equal(envelopes.filter(x => x.parseError).length, 0, name);
    assert.equal(envelopes.filter(x => x.pickle).length, 2, name);
    assert.ok(rtm.includes(name), `RTM missing ${name}`);
  }
  // Images and editable sources must be paired, not just mentioned in a checklist.
  for (const name of readdirSync(new URL('../docs/architecture', import.meta.url)).filter(x => x.endsWith('.puml'))) {
    const svg = read('docs/architecture/' + name.replace('.puml', '.svg'));
    assert.match(svg, /<svg/);
    assert.doesNotMatch(svg, /Syntax Error|An error has occur/i);
  }
});

function validateExample(value, schema) {
  if (value === null && schema.nullable) return;
  if (schema.type === 'array') {
    assert.ok(Array.isArray(value));
    value.forEach(v => validateExample(v, schema.items));
  } else if (schema.type === 'object') {
    assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
    for (const key of schema.required || []) assert.ok(key in value, `Missing field ${key}`);
    for (const [key, v] of Object.entries(value)) {
      if (schema.properties?.[key]) validateExample(v, schema.properties[key]);
    }
  } else if (schema.type === 'integer') {
    assert.ok(Number.isInteger(value));
  } else {
    assert.equal(typeof value, schema.type);
  }
  if (schema.enum) assert.ok(schema.enum.includes(value));
}

test('Handoff: gọi toàn bộ mock, kiểm tra status/body, lỗi, Swagger UI và nhãn giả lập', async t => {
  const spec = await SwaggerParser.dereference(JSON.parse(read('docs/api/openapi.yaml')));
  const server = createMock().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const response = await fetch(base + '/api/v1' + path.replace(/\{\w+\}/g, '00000000-0000-4000-8000-000000000002'), {
        method: method.toUpperCase(), headers: {'Content-Type': 'application/json'},
        ...(operation.requestBody ? {body: '{}'} : {})
      });
      assert.equal(response.headers.get('X-Mock-Only'), 'true');
      assert.equal(response.status, operation['x-mock-status']);
      validateExample(await response.json(), operation.responses[response.status].content['application/json'].schema);
    }
  }
  for (const status of [400, 401, 403, 404, 409, 410, 422, 500]) {
    const r = await fetch(base + '/api/v1/patients', {headers: {'X-Mock-Status': String(status)}});
    assert.equal(r.status, status);
    assert.equal((await r.json()).code, status);
  }
  assert.equal((await fetch(base + '/missing')).status, 404);
  assert.match(await (await fetch(base + '/docs')).text(), /SwaggerUIBundle/);
  assert.equal((await fetch(base + '/swagger/swagger-ui-bundle.js')).status, 200);
});

test('Handoff: DDL/seed PostgreSQL, FK, một đơn hiệu lực, xác nhận bất biến và rollback', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(read('database/schema.sql'));
  await db.exec(read('database/seed.sql'));
  const {rows} = await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
  assert.ok(rows.length >= 20);
  await assert.rejects(db.exec("INSERT INTO patients(id,caregiver_id,nickname,birth_year) VALUES ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','BN-TEST',1960)"), /foreign key/i);
  await assert.rejects(db.exec("INSERT INTO prescriptions(id,patient_id,issued_on,starts_on,ends_on,status) SELECT '10000000-0000-4000-8000-000000000003',patient_id,issued_on,starts_on,ends_on,'active' FROM prescriptions LIMIT 1"), /unique/i);
  await assert.rejects(db.exec("UPDATE prescriptions SET ends_on=starts_on-1"), /check constraint/i);
  const insert = `INSERT INTO dose_confirmations(id,dose_id,actor_device_id,actor_role,took_at,recorded_at,status)
    VALUES ('00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000003','patient','2026-10-20T07:30:00+07:00','2026-10-20T07:31:00+07:00','taken')`;
  await db.exec(insert);
  await assert.rejects(db.exec(insert.replace('000000000008', '000000000009')), /unique/i);
  await assert.rejects(db.exec("DELETE FROM dose_confirmations"), /Append-only/);
  await assert.rejects(db.exec("UPDATE dose_confirmations SET reason='changed'"), /Append-only/);
  await assert.rejects(db.exec("DELETE FROM audit_logs"), /Append-only/);
  await db.exec("BEGIN; INSERT INTO ingredients(id,name) VALUES('10000000-0000-4000-8000-000000000004','DEMO_ROLLBACK'); ROLLBACK;");
  assert.equal((await db.query("SELECT * FROM ingredients WHERE name='DEMO_ROLLBACK'")).rows.length, 0);
});
