import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVictoriaMetricsEndpointForm } from './MetricsEndpointsPage.tsx';

const validForm = {
  name: 'vm-prod',
  description: '生产 VictoriaMetrics 集群',
  remoteWriteURL: 'http://vminsert:8480/insert/0/prometheus/api/v1/write',
  queryURL: 'http://vmselect:8481/select/0/prometheus',
  vmuiURL: 'http://vmselect:8481/select/0/vmui/',
  status: 'active',
};

test('VMS 登记表单接受带租户占位路径的 VictoriaMetrics Cluster 地址', () => {
  assert.deepEqual(validateVictoriaMetricsEndpointForm(validForm), []);
});

test('VMS 登记表单拒绝 vmsingle 或缺少租户占位路径的地址', () => {
  const missing = validateVictoriaMetricsEndpointForm({
    ...validForm,
    remoteWriteURL: 'http://victoriametrics:8428/api/v1/write',
    queryURL: 'http://victoriametrics:8428/api/v1/query',
    vmuiURL: 'http://victoriametrics:8428/vmui/',
  });

  assert.deepEqual(missing, ['Remote Write 租户占位路径', '查询租户占位路径', 'VMUI 租户占位路径']);
});

test('VMS 登记表单拒绝内嵌账号密码和非 HTTP 协议', () => {
  const missing = validateVictoriaMetricsEndpointForm({
    ...validForm,
    remoteWriteURL: 'http://user:password@vminsert:8480/insert/0/prometheus/api/v1/write',
    queryURL: 'ftp://vmselect:8481/select/0/prometheus',
  });

  assert.deepEqual(missing, ['Remote Write 地址', '查询地址']);
});
