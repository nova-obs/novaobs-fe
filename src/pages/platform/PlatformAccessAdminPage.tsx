import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { DataPanel } from '../../components/DataPanel';
import { usePlatformAccess } from '../../layouts/access';
import { api } from '../../services/api';
import { k8sApi } from '../k8s/api';
import { accessApi, type K8sAccessLevel, type ProductAccessRole } from './accessApi';
import { platformApi } from './api';
import {
  BreakGlassForm,
  EditorDrawer,
  IdentityForm,
  K8sGrantForm,
  K8sProfileForm,
  MembershipForm,
  PlatformAdminForm,
  ProductAccessForm,
  editorTitle,
  parseNamespaces,
} from './PlatformAccessForms';
import {
  AccessTabNav,
  BreakGlassWorkspace,
  IdentityWorkspace,
  K8sProfilesWorkspace,
  PlatformAdminsWorkspace,
  ProductAccessWorkspace,
} from './PlatformAccessWorkspaces';

export type AccessTab = 'identities' | 'platform-admins' | 'product-access' | 'k8s-profiles' | 'break-glass';
export type Editor = 'identity' | 'membership' | 'platform-admin' | 'product-access' | 'k8s-profile' | 'k8s-grant' | 'break-glass';
export type IdentityKind = 'user' | 'group' | 'service-account';
export interface IdentityDraft {
  kind: IdentityKind;
  name: string;
  displayName: string;
  email: string;
  password: string;
  owner: string;
  description: string;
}

const emptyIdentityDraft: IdentityDraft = {
  kind: 'user',
  name: '',
  displayName: '',
  email: '',
  password: '',
  owner: '',
  description: '',
};

const emptyProfileDraft = {
  name: '',
  clusterId: '',
  accessLevel: 'developer' as K8sAccessLevel,
  namespacesText: '',
  wholeNamespaceConfirmed: false,
};

export function PlatformAccessAdminPage() {
  const queryClient = useQueryClient();
  const { data: currentAccess } = usePlatformAccess();
  const [activeTab, setActiveTab] = useState<AccessTab>('identities');
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [identityDraft, setIdentityDraft] = useState(emptyIdentityDraft);
  const [membershipDraft, setMembershipDraft] = useState({ groupId: '', subjectType: 'user', subjectId: '' });
  const [adminDraft, setAdminDraft] = useState({ subjectType: 'user' as 'user' | 'group', subjectId: '' });
  const [productDraft, setProductDraft] = useState({
    productId: '',
    subjectType: 'group' as 'group' | 'service-account',
    subjectId: '',
    role: 'product-viewer' as ProductAccessRole,
  });
  const [profileDraft, setProfileDraft] = useState(emptyProfileDraft);
  const [editingProfileId, setEditingProfileId] = useState('');
  const [k8sGrantDraft, setK8sGrantDraft] = useState({ profileId: '', groupId: '' });
  const [breakGlassDraft, setBreakGlassDraft] = useState({ clusterId: '', reason: '' });
  const [approvalMinutes, setApprovalMinutes] = useState(60);
  const namespaces = parseNamespaces(profileDraft.namespacesText);
  const profileHasInvalidNamespace = namespaces.some((namespace) => namespace === '*' || namespace === 'all_namespaces');

  const usersQuery = useQuery({ queryKey: ['platform-users'], queryFn: platformApi.listUsers, retry: false });
  const groupsQuery = useQuery({ queryKey: ['platform-groups'], queryFn: platformApi.listGroups, retry: false });
  const membershipsQuery = useQuery({ queryKey: ['platform-group-memberships'], queryFn: platformApi.listMemberships, retry: false });
  const serviceAccountsQuery = useQuery({ queryKey: ['platform-service-accounts'], queryFn: platformApi.listServiceAccounts, retry: false });
  const productsQuery = useQuery({ queryKey: ['platform-products'], queryFn: api.getProductsForAdministration, retry: false });
  const clustersQuery = useQuery({ queryKey: ['platform-k8s-clusters'], queryFn: () => k8sApi.listClustersForAdministration(), retry: false });
  const adminsQuery = useQuery({ queryKey: ['fixed-access', 'platform-admins'], queryFn: accessApi.listPlatformAdminGrants, retry: false });
  const profilesQuery = useQuery({ queryKey: ['fixed-access', 'k8s-profiles'], queryFn: accessApi.listK8sAccessProfiles, retry: false });
  const k8sGrantsQuery = useQuery({ queryKey: ['fixed-access', 'k8s-grants'], queryFn: () => accessApi.listK8sAccessGrants(), retry: false });
  const breakGlassQuery = useQuery({ queryKey: ['fixed-access', 'break-glass'], queryFn: accessApi.listBreakGlassGrants, retry: false });
  const profileClusterId = profileDraft.clusterId || clustersQuery.data?.[0]?.id || '';
  const namespaceImpactsQuery = useQuery({
    queryKey: ['fixed-access', 'namespace-impacts', profileClusterId, namespaces],
    queryFn: () => accessApi.listK8sNamespaceImpacts(profileClusterId, namespaces),
    enabled: activeEditor === 'k8s-profile' && Boolean(profileClusterId) && namespaces.length > 0 && !profileHasInvalidNamespace,
    retry: false,
  });

  const users = usersQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const memberships = membershipsQuery.data ?? [];
  const serviceAccounts = serviceAccountsQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const clusters = clustersQuery.data ?? [];
  const admins = adminsQuery.data ?? [];
  const profiles = profilesQuery.data ?? [];
  const k8sGrants = k8sGrantsQuery.data ?? [];
  const breakGlassGrants = breakGlassQuery.data ?? [];

  const productGrantQueries = useQueries({
    queries: products.map((product) => ({
      queryKey: ['fixed-access', 'product-grants', product.id],
      queryFn: () => accessApi.listProductAccessGrants(product.id),
      retry: false,
    })),
  });
  const productGrants = useMemo(
    () => products.flatMap((product, index) => (
      (productGrantQueries[index]?.data ?? []).map((grant) => ({ ...grant, productName: product.name }))
    )),
    [productGrantQueries, products],
  );

  const invalidateIdentity = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['platform-users'] }),
    queryClient.invalidateQueries({ queryKey: ['platform-groups'] }),
    queryClient.invalidateQueries({ queryKey: ['platform-group-memberships'] }),
    queryClient.invalidateQueries({ queryKey: ['platform-service-accounts'] }),
    queryClient.invalidateQueries({ queryKey: ['platform-me'] }),
  ]);
  const invalidateFixedAccess = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['fixed-access'] }),
    queryClient.invalidateQueries({ queryKey: ['platform-me'] }),
  ]);

  const createIdentity = useMutation({
    mutationFn: async () => {
      if (identityDraft.kind === 'group') {
        return platformApi.createGroup({
          name: identityDraft.name.trim(),
          displayName: identityDraft.displayName.trim(),
          description: identityDraft.description.trim(),
        });
      }
      if (identityDraft.kind === 'service-account') {
        return platformApi.createServiceAccount({
          name: identityDraft.name.trim(),
          displayName: identityDraft.displayName.trim(),
          owner: identityDraft.owner.trim(),
          description: identityDraft.description.trim(),
        });
      }
      return platformApi.createUser({
        username: identityDraft.name.trim(),
        displayName: identityDraft.displayName.trim(),
        email: identityDraft.email.trim(),
        password: identityDraft.password,
      });
    },
    onSuccess: async () => {
      setIdentityDraft(emptyIdentityDraft);
      setActiveEditor(null);
      await invalidateIdentity();
    },
  });
  const deleteIdentity = useMutation<unknown, Error, { kind: IdentityKind; id: string }>({
    mutationFn: ({ kind, id }) => (
      kind === 'group'
        ? platformApi.deleteGroup(id)
        : kind === 'service-account'
          ? platformApi.deleteServiceAccount(id)
          : platformApi.deleteUser(id)
    ),
    onSuccess: invalidateIdentity,
  });
  const createMembership = useMutation({
    mutationFn: () => platformApi.createMembership({
      ...membershipDraft,
      groupId: membershipDraft.groupId || groups[0]?.id || '',
      subjectId: membershipDraft.subjectId || (
        membershipDraft.subjectType === 'service-account' ? serviceAccounts[0]?.id : users[0]?.id
      ) || '',
    }),
    onSuccess: async () => {
      setActiveEditor(null);
      await invalidateIdentity();
    },
  });
  const deleteMembership = useMutation({ mutationFn: platformApi.deleteMembership, onSuccess: invalidateIdentity });
  const createAdmin = useMutation({
    mutationFn: () => accessApi.createPlatformAdminGrant({
      subjectType: adminDraft.subjectType,
      subjectId: adminDraft.subjectId || (
        adminDraft.subjectType === 'group' ? groups[0]?.id : users[0]?.id
      ) || '',
    }),
    onSuccess: async () => {
      setActiveEditor(null);
      await invalidateFixedAccess();
    },
  });
  const deleteAdmin = useMutation({ mutationFn: accessApi.deletePlatformAdminGrant, onSuccess: invalidateFixedAccess });
  const createProductGrant = useMutation({
    mutationFn: () => accessApi.createProductAccessGrant(productDraft.productId || products[0]?.id || '', {
      subjectType: productDraft.subjectType,
      subjectId: productDraft.subjectId || (
        productDraft.subjectType === 'group' ? groups[0]?.id : serviceAccounts[0]?.id
      ) || '',
      role: productDraft.role,
    }),
    onSuccess: async () => {
      setActiveEditor(null);
      await invalidateFixedAccess();
    },
  });
  const deleteProductGrant = useMutation({
    mutationFn: ({ productId, grantId }: { productId: string; grantId: string }) => (
      accessApi.deleteProductAccessGrant(productId, grantId)
    ),
    onSuccess: invalidateFixedAccess,
  });
  const saveProfile = useMutation({
    mutationFn: () => {
      const input = {
        name: profileDraft.name.trim(),
        accessLevel: profileDraft.accessLevel,
        namespaces: parseNamespaces(profileDraft.namespacesText),
        wholeNamespaceConfirmed: profileDraft.wholeNamespaceConfirmed,
      };
      return editingProfileId
        ? accessApi.updateK8sAccessProfile(editingProfileId, input)
        : accessApi.createK8sAccessProfile({
          ...input,
          clusterId: profileDraft.clusterId || clusters[0]?.id || '',
        });
    },
    onSuccess: async () => {
      setProfileDraft(emptyProfileDraft);
      setEditingProfileId('');
      setActiveEditor(null);
      await invalidateFixedAccess();
    },
  });
  const deleteProfile = useMutation({ mutationFn: accessApi.deleteK8sAccessProfile, onSuccess: invalidateFixedAccess });
  const syncProfile = useMutation({ mutationFn: accessApi.syncK8sAccessProfile, onSuccess: invalidateFixedAccess });
  const createK8sGrant = useMutation({
    mutationFn: () => accessApi.createK8sAccessGrant({
      profileId: k8sGrantDraft.profileId || profiles[0]?.id || '',
      groupId: k8sGrantDraft.groupId || groups[0]?.id || '',
    }),
    onSuccess: async () => {
      setActiveEditor(null);
      await invalidateFixedAccess();
    },
  });
  const deleteK8sGrant = useMutation({ mutationFn: accessApi.deleteK8sAccessGrant, onSuccess: invalidateFixedAccess });
  const requestBreakGlass = useMutation({
    mutationFn: () => accessApi.requestBreakGlassGrant({
      clusterId: breakGlassDraft.clusterId || clusters[0]?.id || '',
      reason: breakGlassDraft.reason.trim(),
    }),
    onSuccess: async () => {
      setBreakGlassDraft({ clusterId: '', reason: '' });
      setActiveEditor(null);
      await invalidateFixedAccess();
    },
  });
  const approveBreakGlass = useMutation({
    mutationFn: (id: string) => accessApi.approveBreakGlassGrant(id, Math.min(120, Math.max(1, approvalMinutes))),
    onSuccess: invalidateFixedAccess,
  });
  const revokeBreakGlass = useMutation({ mutationFn: accessApi.revokeBreakGlassGrant, onSuccess: invalidateFixedAccess });

  const errors = [
    usersQuery.error,
    groupsQuery.error,
    membershipsQuery.error,
    serviceAccountsQuery.error,
    productsQuery.error,
    clustersQuery.error,
    adminsQuery.error,
    profilesQuery.error,
    k8sGrantsQuery.error,
    breakGlassQuery.error,
    ...productGrantQueries.map((query) => query.error),
    createIdentity.error,
    deleteIdentity.error,
    createMembership.error,
    deleteMembership.error,
    createAdmin.error,
    deleteAdmin.error,
    createProductGrant.error,
    deleteProductGrant.error,
    saveProfile.error,
    deleteProfile.error,
    syncProfile.error,
    createK8sGrant.error,
    deleteK8sGrant.error,
    requestBreakGlass.error,
    approveBreakGlass.error,
    revokeBreakGlass.error,
  ].filter(Boolean);
  const adminSubjects = adminDraft.subjectType === 'group' ? groups : users;
  const productSubjects = productDraft.subjectType === 'group' ? groups : serviceAccounts;
  const membershipSubjects = membershipDraft.subjectType === 'service-account' ? serviceAccounts : users;
  return (
    <div className="space-y-4">
      <DataPanel className="platform-access-panel" title="平台访问控制" action={<AccessTabNav activeTab={activeTab} onChange={setActiveTab} />}>
        <div className="console-notice mb-3">
          <ShieldCheck className="h-4 w-4" />
          平台、Product 与 K8S 是三条独立授权边界；平台管理员不会自动获得产品数据或工作负载权限。
        </div>
        {errors[0] ? <ErrorNotice error={errors[0]} /> : null}

        {activeTab === 'identities' ? (
          <IdentityWorkspace
            users={users}
            groups={groups}
            memberships={memberships}
            serviceAccounts={serviceAccounts}
            currentUserId={currentAccess?.subject.id ?? ''}
            onCreateIdentity={() => setActiveEditor('identity')}
            onCreateMembership={() => setActiveEditor('membership')}
            onDeleteIdentity={(kind, id, label) => {
              if (window.confirm(`确认删除 ${label}？相关固定授权必须由后端阻止悬空引用。`)) {
                deleteIdentity.mutate({ kind, id });
              }
            }}
            onDeleteMembership={(id) => {
              if (window.confirm('确认移除该用户组成员关系？')) deleteMembership.mutate(id);
            }}
          />
        ) : null}

        {activeTab === 'platform-admins' ? (
          <PlatformAdminsWorkspace
            grants={admins}
            users={users}
            groups={groups}
            onCreate={() => setActiveEditor('platform-admin')}
            onDelete={(grant) => {
              if (window.confirm('确认撤销该平台管理员？后端会保护最后一名管理员。')) deleteAdmin.mutate(grant.id);
            }}
          />
        ) : null}

        {activeTab === 'product-access' ? (
          <ProductAccessWorkspace
            grants={productGrants}
            groups={groups}
            serviceAccounts={serviceAccounts}
            onCreate={() => setActiveEditor('product-access')}
            onDelete={(grant) => {
              if (window.confirm('确认撤销该 Product 授权？授权会自动覆盖 Product 下全部 Service。')) {
                deleteProductGrant.mutate({ productId: grant.productId, grantId: grant.id });
              }
            }}
          />
        ) : null}

        {activeTab === 'k8s-profiles' ? (
          <K8sProfilesWorkspace
            profiles={profiles}
            grants={k8sGrants}
            groups={groups}
            onCreateProfile={() => {
              setEditingProfileId('');
              setProfileDraft(emptyProfileDraft);
              setActiveEditor('k8s-profile');
            }}
            onCreateGrant={() => setActiveEditor('k8s-grant')}
            onEditProfile={(profile) => {
              setEditingProfileId(profile.id);
              setProfileDraft({
                name: profile.name,
                clusterId: profile.clusterId,
                accessLevel: profile.accessLevel,
                namespacesText: profile.namespaces.join('\n'),
                wholeNamespaceConfirmed: false,
              });
              setActiveEditor('k8s-profile');
            }}
            onSync={(id) => syncProfile.mutate(id)}
            onDeleteProfile={(profile) => {
              if (window.confirm(`确认删除 Profile「${profile.name}」？关联用户组会立即失去对应 Namespace 权限。`)) {
                deleteProfile.mutate(profile.id);
              }
            }}
            onDeleteGrant={(grant) => {
              if (window.confirm('确认撤销该用户组的 K8S Profile？')) deleteK8sGrant.mutate(grant.id);
            }}
          />
        ) : null}

        {activeTab === 'break-glass' ? (
          <BreakGlassWorkspace
            grants={breakGlassGrants}
            currentUserId={currentAccess?.subject.id ?? ''}
            approvalMinutes={approvalMinutes}
            setApprovalMinutes={setApprovalMinutes}
            onRequest={() => setActiveEditor('break-glass')}
            onApprove={(grant) => {
              if (window.confirm(`确认批准 ${approvalMinutes} 分钟 Break Glass？必须由另一名平台管理员审批。`)) {
                approveBreakGlass.mutate(grant.id);
              }
            }}
            onRevoke={(grant) => {
              if (window.confirm('确认立即撤销该 Break Glass？')) revokeBreakGlass.mutate(grant.id);
            }}
          />
        ) : null}
      </DataPanel>

      {activeEditor ? (
        <EditorDrawer
          title={activeEditor === 'k8s-profile' && editingProfileId ? '编辑 K8S Access Profile' : editorTitle(activeEditor)}
          onClose={() => {
            setActiveEditor(null);
            setEditingProfileId('');
          }}
        >
          {activeEditor === 'identity' ? <IdentityForm draft={identityDraft} setDraft={setIdentityDraft} pending={createIdentity.isPending} onSubmit={() => createIdentity.mutate()} /> : null}
          {activeEditor === 'membership' ? <MembershipForm draft={membershipDraft} groups={groups} subjects={membershipSubjects} setDraft={setMembershipDraft} pending={createMembership.isPending} onSubmit={() => createMembership.mutate()} /> : null}
          {activeEditor === 'platform-admin' ? <PlatformAdminForm draft={adminDraft} subjects={adminSubjects} setDraft={setAdminDraft} pending={createAdmin.isPending} onSubmit={() => createAdmin.mutate()} /> : null}
          {activeEditor === 'product-access' ? <ProductAccessForm draft={productDraft} products={products} subjects={productSubjects} setDraft={setProductDraft} pending={createProductGrant.isPending} onSubmit={() => createProductGrant.mutate()} /> : null}
          {activeEditor === 'k8s-profile' ? (
            <K8sProfileForm
              draft={profileDraft}
              clusters={clusters}
              namespaces={namespaces}
              invalidNamespace={profileHasInvalidNamespace}
              impacts={namespaceImpactsQuery.data ?? []}
              impactsLoading={namespaceImpactsQuery.isLoading || namespaceImpactsQuery.isFetching}
              impactsError={namespaceImpactsQuery.error instanceof Error ? namespaceImpactsQuery.error : null}
              editing={Boolean(editingProfileId)}
              setDraft={setProfileDraft}
              pending={saveProfile.isPending}
              onSubmit={() => saveProfile.mutate()}
            />
          ) : null}
          {activeEditor === 'k8s-grant' ? <K8sGrantForm draft={k8sGrantDraft} profiles={profiles} groups={groups} setDraft={setK8sGrantDraft} pending={createK8sGrant.isPending} onSubmit={() => createK8sGrant.mutate()} /> : null}
          {activeEditor === 'break-glass' ? <BreakGlassForm draft={breakGlassDraft} clusters={clusters} setDraft={setBreakGlassDraft} pending={requestBreakGlass.isPending} onSubmit={() => requestBreakGlass.mutate()} /> : null}
        </EditorDrawer>
      ) : null}
    </div>
  );
}

function ErrorNotice({ error }: { error: unknown }) {
  return (
    <div className="console-notice console-notice-warning mb-3">
      <AlertTriangle className="h-4 w-4" />
      访问控制数据读取或写入失败：{error instanceof Error ? error.message : '未知错误'}
    </div>
  );
}
