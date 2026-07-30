import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const platformApiSource = readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const k8sApiSource = readFileSync(new URL('../k8s/api.ts', import.meta.url), 'utf8');

test('平台共享 API 不再暴露通用 Role、Binding、Permission 和 ScopeMode', () => {
  for (const legacySymbol of [
    'PlatformScope',
    'PlatformPermission',
    'PlatformRole',
    'PlatformBinding',
    'PlatformEffectivePermission',
    'listRoles',
    'createRole',
    'deleteRole',
    'listBindings',
    'createBinding',
    'deleteBinding',
    'effectivePermissions',
    '/platform/roles',
    '/platform/bindings',
    '/platform/effective-permissions',
  ]) {
    assert.equal(platformApiSource.includes(legacySymbol), false, legacySymbol);
  }
});

test('平台共享 API 不再暴露未闭环的服务账号', () => {
  for (const removedSymbol of [
    'PlatformServiceAccount',
    'listServiceAccounts',
    'createServiceAccount',
    'deleteServiceAccount',
    '/platform/service-accounts',
  ]) {
    assert.equal(platformApiSource.includes(removedSymbol), false, removedSymbol);
  }
});

test('K8S 共享 API 不再暴露已下线的自由权限与 kubeconfig 资源', () => {
  for (const legacySymbol of [
    'K8sCertificate',
    'K8sServiceAccount',
    'K8sRBACRole',
    'K8sRBACBinding',
    'K8sKubeconfigMetadata',
    'K8sKubeconfigExport',
    'K8sPlatformAccessProfile',
    'K8sPlatformAccessBinding',
    'listCertificates',
    'createCertificate',
    'deleteCertificate',
    'listServiceAccounts',
    'createServiceAccount',
    'deleteServiceAccount',
    'listRBACRoles',
    'listRBACBindings',
    'createRBACRole',
    'createRBACBinding',
    'deleteRBACBinding',
    'createKubeconfig',
    'exportKubeconfig',
    'listPlatformAccessProfiles',
    'createPlatformAccessBinding',
    'deletePlatformAccessBinding',
    '/k8s/certificates',
    '/k8s/service-accounts',
    '/k8s/rbac/',
    '/k8s/kubeconfigs',
    '/k8s/platform-access/',
  ]) {
    assert.equal(k8sApiSource.includes(legacySymbol), false, legacySymbol);
  }
});
