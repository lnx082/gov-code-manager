<template>
  <div class="page-container">
    <div class="page-header">
      <h2 class="page-title">基线管理</h2>
      <div class="button-group">
        <el-button type="primary" @click="showCreateDialog">
          <el-icon><Plus /></el-icon>
          新建基线
        </el-button>
      </div>
    </div>

    <el-alert type="info" :closable="false" class="info-alert">
      <template #title>
        <strong>基线说明：</strong>基线是经过评审确认、固化锁定的正式软件版本。它是上线、运维、迭代的唯一标准版本，基线变更必须履行正式审批流程。
      </template>
    </el-alert>

    <div class="table-responsive">
      <el-table :data="baselineList" v-loading="loading" stripe border class="baseline-table" @row-contextmenu.prevent="openMenu">
      <el-table-column label="基线名称" width="200">
        <template #default="{ row }">
          <div class="baseline-cell">
            <el-icon><Lock /></el-icon>
            <span class="baseline-name">{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="version" label="对应版本" width="120" class="col-hide-mobile" />
      <el-table-column label="所属仓库" width="180" class="col-hide-mobile">
        <template #default="{ row }">
          {{ row.displayName || row.repoName }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="基线说明" min-width="200" show-overflow-tooltip class="col-hide-mobile" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : row.status === 'frozen' ? 'warning' : 'info'" size="small">
            {{ row.status === 'active' ? '激活' : row.status === 'frozen' ? '已冻结' : row.status === 'archived' ? '已归档' : row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="creator" label="创建者" width="100" class="col-hide-mobile" />
      <el-table-column label="创建时间" width="160" class="col-hide-mobile">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right" class="action-col">
        <template #default="{ row }">
          <span class="action-btns-desktop">
            <el-button type="primary" link @click="viewDetail(row)">详情</el-button>
            <el-button type="primary" link @click="handleChange(row)" v-if="row.status === 'active'">变更</el-button>
            <el-button type="danger" link @click="handleFreeze(row)" v-if="row.status === 'active'">冻结</el-button>
            <el-button type="warning" link @click="handleUnfreeze(row)" v-if="row.status === 'frozen' && isAdmin">解冻</el-button>
          </span>
          <el-button class="action-more-btn" size="small" @click.stop="onTrigger(row, $event)">
            <el-icon><MoreFilled /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <el-dialog v-model="createDialogVisible" title="创建基线" width="700px">
      <el-form :model="createForm" :rules="createRules" label-width="120px">
        <el-form-item label="基线名称" prop="name">
          <el-input v-model="createForm.name" placeholder="请输入基线名称" style="width: 100%" />
        </el-form-item>
        <el-form-item label="筛选仓库">
          <el-select v-model="filterRepoId" placeholder="按仓库筛选版本" clearable style="width: 100%" @change="onFilterRepoChange">
            <el-option v-for="repo in repoList" :key="repo.id" :label="repo.displayName" :value="repo.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="搜索版本">
          <el-input v-model="versionSearch" placeholder="输入版本号搜索" clearable style="width: 100%" />
        </el-form-item>
        <el-form-item label="选择版本" prop="versionKey">
          <el-select v-model="createForm.versionKey" placeholder="选择版本" style="width: 100%" filterable @change="onVersionSelect">
            <el-option v-for="v in filteredVersionOptions" :key="v.key" :label="v.label" :value="v.key">
              <span>{{ v.name }}</span>
              <span style="float: right; color: #909399; font-size: 12px; margin-left: 8px">{{ v.displayName }}</span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item v-if="selectedVersionConflict" label=" ">
          <el-alert type="warning" :closable="false" show-icon>
            <template #title>
              {{ selectedVersionConflict }}
              <el-button type="warning" link size="small" style="margin-left:8px" @click="goToChangeBaseline">去变更基线 →</el-button>
            </template>
          </el-alert>
        </el-form-item>
        <el-form-item label="基线说明" prop="description">
          <el-input v-model="createForm.description" type="textarea" :rows="4" placeholder="说明基线的用途和适用范围" style="width: 100%" />
        </el-form-item>
        <div class="form-tip" style="margin-left:120px;margin-bottom:12px;color:#909399;font-size:12px">
          提交后将进入默认审批流程（项目管理员审批 → 系统管理员审批）
        </div>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">提交审批</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailDialogVisible" title="基线详情" width="700px">
      <div class="baseline-detail" v-if="currentBaseline">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="基线名称">{{ currentBaseline.name }}</el-descriptions-item>
          <el-descriptions-item label="对应版本">{{ currentBaseline.version }}</el-descriptions-item>
          <el-descriptions-item label="所属仓库">{{ currentBaseline.repoName }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentBaseline.status === 'active' ? 'success' : currentBaseline.status === 'frozen' ? 'warning' : 'info'" size="small">
              {{ currentBaseline.status === 'active' ? '激活' : currentBaseline.status === 'frozen' ? '已冻结' : currentBaseline.status === 'archived' ? '已归档' : currentBaseline.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建者">{{ currentBaseline.creator }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatTime(currentBaseline.createdAt) }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">基线说明</el-divider>
        <div class="description-content">{{ currentBaseline.description }}</div>
        <el-divider content-position="left">基线演化记录</el-divider>
        <el-timeline>
          <el-timeline-item v-for="(item, index) in currentBaseline.history" :key="index" :timestamp="item.time" placement="top">
            <el-card>
              <h4>{{ item.action }}</h4>
              <p>{{ item.detail }}</p>
              <p class="history-user">操作人: {{ item.user }}</p>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-dialog>

    <!-- 基线变更对话框 -->
    <el-dialog v-model="changeDialogVisible" title="基线变更" width="500px">
      <el-form label-width="100px">
        <el-form-item label="当前版本"><el-tag>{{ changeCurrentTag }}</el-tag></el-form-item>
        <el-form-item label="新版本">
          <el-select v-model="changeForm.newTagName" placeholder="选择新版本" style="width:100%" filterable>
            <el-option v-for="t in changeTagOptions" :key="t" :label="t" :value="t" :disabled="t === changeCurrentTag" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="changeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitChange">提交审批</el-button>
      </template>
    </el-dialog>

    <RowContextMenu
      :visible="visible"
      :position="position"
      :actions="currentRow ? getActions(currentRow) : []"
      @close="closeMenu"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MoreFilled, View, Edit, Lock, Unlock } from '@element-plus/icons-vue'
import { getBaselineList, createBaseline, freezeBaseline, unfreezeBaseline } from '@/api/admin'
import { getTags, getMyRepos } from '@/api/gitea'
import { createApproval } from '@/api/bff'
import { useUserStore } from '@/stores/user'
import RowContextMenu from '@/components/RowContextMenu.vue'
import { useRowContextMenu } from '@/composables/useRowContextMenu'

const router = useRouter()
const userStore = useUserStore()
const isAdmin = computed(() => userStore.role === 'admin')

const { visible, position, currentRow, openMenu, closeMenu } = useRowContextMenu()

function getActions(row) {
  return [
    { label: '详情', icon: View, onClick: () => viewDetail(row) },
    { label: '变更', icon: Edit, visible: row.status === 'active', onClick: () => handleChange(row) },
    { label: '冻结', icon: Lock, type: 'danger', visible: row.status === 'active', onClick: () => handleFreeze(row) },
    { label: '解冻', icon: Unlock, type: 'warning', visible: row.status === 'frozen' && userStore.role === 'admin', onClick: () => handleUnfreeze(row) },
  ]
}

const loading = ref(false)
const createDialogVisible = ref(false)
const detailDialogVisible = ref(false)

const baselineList = ref([])
const versionOptions = ref([])
const repoList = ref([])
const filterRepoId = ref('')
const versionSearch = ref('')

const currentBaseline = ref(null)

// 解析中文显示名
function parseDisplayName(desc, fallback) {
  if (!desc) return fallback || ''
  const m = desc.match(/\[显示名=([^\]]+)\]/)
  return m ? m[1] : (fallback || '')
}

const createForm = reactive({
  name: '',
  versionKey: '',
  description: ''
})

const createRules = {
  name: [{ required: true, message: '请输入基线名称', trigger: 'blur' }],
  versionKey: [{ required: true, message: '请选择版本', trigger: 'change' }],
  description: [{ required: true, message: '请输入基线说明', trigger: 'blur' }]
}

// 根据仓库筛选和搜索过滤版本
const filteredVersionOptions = computed(() => {
  let list = versionOptions.value
  if (filterRepoId.value) {
    list = list.filter(v => v.repoId === filterRepoId.value)
  }
  if (versionSearch.value) {
    const q = versionSearch.value.toLowerCase()
    list = list.filter(v => v.name.toLowerCase().includes(q) || v.label.toLowerCase().includes(q))
  }
  return list
})

// 检测所选版本的仓库是否已有基线
const selectedVersionConflict = computed(() => {
  if (!createForm.versionKey) return ''
  const version = versionOptions.value.find(v => v.key === createForm.versionKey)
  if (!version) return ''
  const owner = version.repoOwner, repo = version.repoName
  const existing = baselineList.value.find(b => {
    const bo = b.repo_owner || b.repoOwner
    const bn = b.repo_name || b.repoName
    return bo === owner && bn === repo && (b.status === 'active' || b.status === 'archived' || b.status === 'frozen')
  })
  if (!existing) return ''
  if (existing.status === 'archived') return `该仓库已有归档基线「${existing.name || existing.baseline_name}」，仓库已归档无法创建新基线`
  if (existing.status === 'frozen') return `该仓库已有冻结基线「${existing.name || existing.baseline_name}」，仓库已冻结无法创建新基线`
  return `该仓库已有基线「${existing.name || existing.baseline_name}」，同一仓库只能创建一个基线，请使用基线变更功能`
})

function onVersionSelect() {
  // 选中版本后的处理（由 computed 自动驱动提示）
}

function goToChangeBaseline() {
  createDialogVisible.value = false
  // 找到冲突的基线并打开变更对话框
  const version = versionOptions.value.find(v => v.key === createForm.versionKey)
  if (!version) return
  const owner = version.repoOwner, repo = version.repoName
  const existing = baselineList.value.find(b => {
    const bo = b.repo_owner || b.repoOwner
    const bn = b.repo_name || b.repoName
    return bo === owner && bn === repo && b.status === 'active'
  })
  if (!existing) {
    // 基线可能已冻结或已归档，无法变更
    ElMessage.warning('该仓库的基线已冻结或已归档，无法变更')
    return
  }
  if (existing) {
    // 直接打开基线变更对话框
    changeForm.baselineId = existing.baseline_id
    changeForm.repoOwner = existing.repo_owner || existing.repoOwner
    changeForm.repoName = existing.repo_name || existing.repoName
    changeForm.newTagName = ''
    changeCurrentTag.value = existing.tag_name || existing.version || ''
    changeTagOptions.value = []
    changeDialogVisible.value = true
    getTags(changeForm.repoOwner, changeForm.repoName).then(res => {
      const tags = res.data || res
      changeTagOptions.value = (Array.isArray(tags) ? tags : []).map(t => t.name)
    }).catch(() => { changeTagOptions.value = [] })
  }
}

onMounted(() => {
  loadBaselines()
  loadVersions()
})

async function loadBaselines() {
  loading.value = true
  try {
    const res = await getBaselineList()
    const data = res.data || res
    const list = data.list || data.records || data || []
    baselineList.value = (Array.isArray(list) ? list : []).map(b => ({
      ...b,
      displayName: b.displayName || b.repoName || parseDisplayName(b.description, b.repoName)
    }))
  } catch (error) {
    ElMessage.warning('加载基线列表失败')
    baselineList.value = []
  } finally {
    loading.value = false
  }
}

async function loadVersions() {
  try {
    // 从 Gitea 加载真实 tags，而非假数据
    const reposRes = await getMyRepos({ page: 1, limit: 100 })
    const repos = reposRes.data || reposRes
    const repoArray = Array.isArray(repos) ? repos : []

    repoList.value = repoArray.map(r => {
      const owner = r.owner?.login || r.owner?.username || ''
      const name = r.name
      return {
        id: r.id,
        name: r.full_name || r.name,
        displayName: parseDisplayName(r.description, r.full_name || r.name),
        owner,
        repo: name
      }
    })

    const allVersions = []
    for (const repo of repoList.value) {
      try {
        if (!repo.owner || !repo.repo) continue
        const tagRes = await getTags(repo.owner, repo.repo)
        const tags = tagRes.data || tagRes
        const tagArray = Array.isArray(tags) ? tags : []
        tagArray.forEach(t => allVersions.push({
          key: `${repo.owner}/${repo.repo}@${t.name}`,
          name: t.name,
          label: `${t.name} — ${repo.displayName}`,
          displayName: repo.displayName,
          repoId: repo.id,
          repoOwner: repo.owner,
          repoName: repo.repo,
          sha: t.commit?.sha || ''
        }))
      } catch { /* skip failed repos */ }
    }
    versionOptions.value = allVersions
  } catch (error) {
    ElMessage.warning('加载版本列表失败')
  }
}

// 切换筛选仓库时重置搜索
function onFilterRepoChange() {
  // 筛选变化会自动触发 computed 重新计算
}

function showCreateDialog() {
  createForm.name = ''
  createForm.versionKey = ''
  createForm.description = ''
  filterRepoId.value = ''
  versionSearch.value = ''
  createDialogVisible.value = true
}

async function handleCreate() {
  if (!createForm.name || !createForm.versionKey || !createForm.description) {
    ElMessage.warning('请填写必填项')
    return
  }
  const version = versionOptions.value.find(v => v.key === createForm.versionKey)
  if (!version) {
    ElMessage.warning('请选择有效的版本')
    return
  }
  try {
    await createBaseline({
      name: createForm.name,
      versionKey: createForm.versionKey,
      versionName: version.name,
      repoOwner: version.repoOwner,
      repoName: version.repoName,
      sha: version.sha,
      description: createForm.description
    })
    ElMessage.success('基线创建申请已提交，等待审批')
    createDialogVisible.value = false
    loadBaselines()
  } catch (error) {
    const msg = error?.response?.data?.message || error?.message || '创建基线失败'
    ElMessage.warning(msg)
  }
}

function viewDetail(row) {
  currentBaseline.value = row
  detailDialogVisible.value = true
}

const changeDialogVisible = ref(false)
const changeForm = reactive({ baselineId: '', newTagName: '', repoOwner: '', repoName: '' })
const changeTagOptions = ref([])
const changeCurrentTag = ref('')

function handleChange(row) {
  changeForm.baselineId = row.baseline_id
  changeForm.repoOwner = row.repo_owner || row.repoOwner
  changeForm.repoName = row.repo_name || row.repoName
  changeForm.newTagName = ''
  changeCurrentTag.value = row.tag_name || row.version || ''
  changeTagOptions.value = []
  changeDialogVisible.value = true
  // 加载该仓库的所有版本
  getTags(changeForm.repoOwner, changeForm.repoName).then(res => {
    const tags = res.data || res
    changeTagOptions.value = (Array.isArray(tags) ? tags : []).map(t => t.name)
  }).catch(() => { changeTagOptions.value = [] })
}

async function submitChange() {
  if (!changeForm.newTagName) { ElMessage.warning('请选择新版本'); return }
  try {
    await createApproval({
      operationType: 'baseline_change',
      title: `基线变更: ${changeCurrentTag.value} → ${changeForm.newTagName}`,
      description: `将基线版本从 ${changeCurrentTag.value} 变更为 ${changeForm.newTagName}`,
      repoOwner: changeForm.repoOwner, repoName: changeForm.repoName,
      body: JSON.stringify({
        baselineId: changeForm.baselineId, newTagName: changeForm.newTagName, newSha: ''
      })
    })
    ElMessage.success('变更申请已提交，等待审批')
    changeDialogVisible.value = false
    loadBaselines()
  } catch (e) {
    ElMessage.error('提交失败: ' + (e?.response?.data?.message || e?.message || ''))
  }
}

async function handleFreeze(row) {
  try {
    await ElMessageBox.confirm(
      `确定要冻结基线 "${row.name}" 吗？冻结后该基线不能再变更，对应仓库将被锁定为只读。`,
      '冻结基线', { type: 'warning' }
    )
    await createApproval({
      operationType: 'baseline_freeze',
      title: `基线冻结: ${row.name}`,
      description: `冻结基线 ${row.name}，锁定仓库`,
      repoOwner: row.repo_owner || row.repoOwner, repoName: row.repo_name || row.repoName,
      body: JSON.stringify({
        baselineId: row.baseline_id,
        repoOwner: row.repo_owner || row.repoOwner, repoName: row.repo_name || row.repoName
      })
    })
    ElMessage.success('冻结申请已提交，等待审批')
  } catch (e) {
    if (e !== 'cancel') ElMessage.warning('冻结失败: ' + (e?.message || ''))
  }
}

async function handleUnfreeze(row) {
  try {
    await ElMessageBox.confirm(
      `确定要解冻基线 "${row.name}" 吗？解冻后仓库将恢复读写，基线恢复为激活状态。`,
      '解冻基线', { type: 'warning' }
    )
    await unfreezeBaseline(row.baseline_id)
    ElMessage.success('基线已解冻，仓库已恢复读写')
    loadBaselines()
  } catch (e) {
    if (e !== 'cancel') ElMessage.warning('解冻失败: ' + (e?.response?.data?.message || e?.message || ''))
  }
}

function onTrigger(row, event) {
  openMenu(row, event)
}

function formatTime(time) {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style lang="scss" scoped>
.info-alert {
  margin-bottom: 20px;
}

.baseline-table {
  margin-top: 20px;
}

.baseline-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .baseline-name {
    font-weight: 600;
    color: #303133;
  }
}

.baseline-detail {
  .description-content {
    padding: 15px;
    background: #f5f7fa;
    border-radius: 6px;
    line-height: 1.6;
  }

  .history-user {
    font-size: 12px;
    color: #909399;
    margin-top: 5px;
  }
}

.action-btns-desktop { display: inline; }
.action-more-btn { display: none; }

@media (max-width: 768px) {
  .action-btns-desktop { display: none; }
  .action-more-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 28px;
    padding: 0 6px;
  }
}
</style>
