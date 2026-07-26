/**
 * 根组件（布局框架/侧边栏/顶部导航/路由视图）
 */
<template>
  <div class="app-container" v-if="userStore.isAuthenticated">
    <!-- 顶部导航栏 - 政务风格 -->
    <header class="gov-header">
      <div class="header-left">
        <el-button class="hamburger-btn" @click="mobileDrawerVisible = true">
          <el-icon :size="22"><Operation /></el-icon>
        </el-button>
        <svg t="1783868029100" class="header-emblem-svg" viewBox="0 0 1024 1024" width="28" height="28"><path d="M513.697876 0l40.17103 2.817752 38.870528 5.346504 37.244902 7.911381 35.763777 10.331757 34.174275 12.607635 32.657024 14.73901 30.959147 16.906513 29.333522 18.496013 27.74402 20.663515 25.865519 22.108517 24.239893 23.625767 22.361391 25.070768 20.663515 26.551895 18.857264 27.59952 16.906512 28.719396 14.991886 29.622522 13.113385 30.417272 11.126508 31.248148 9.139632 31.645523 7.080505 32.187399 5.093629 32.584773 2.962252 32.83765 0.903126 32.873774-1.336626 32.837649-3.323503 32.729274-5.780004 32.584773-7.911381 32.042899-10.151132 31.645523-12.463134 30.959148-14.739011 30.164397-17.303888 29.369646-19.543639 28.430396 92.552318 88.217315-124.161716 129.688845-91.107317-90.240316-19.146264 11.523883-19.182389 10.873633-19.290764 10.042758-19.290764 9.248006-19.290765 8.561632-19.435264 7.803005-19.399139 7.11663-19.435264 6.285755-19.579765 5.346504-19.399139 4.840754-19.579764 3.901502-19.543639 3.215128-19.68814 2.420377-19.579764 1.589501-19.543639 0.686375-19.579765 0.108375-19.543639-0.79475-19.435264-1.589501-19.579765-2.420377-19.543639-3.106753-19.435264-4.009877-19.54364-4.840754-19.435264-5.491004-19.290764-6.430255-19.290764-7.225005-19.290764-8.200381-19.290764-8.706131-19.146264-9.789883-19.037889-10.584632-19.037889-11.415509-19.001764-12.210259-18.893389-12.968884-14.08876 13.79976 0.93925 7.622381 0.397376 7.26113v7.225005l-0.505751 6.863755-0.93925 6.68313-1.481126 6.32188-1.878502 6.141254-2.131376 5.924505-2.564877 5.635504-3.070628 5.346504-3.359627 4.949128-3.612503 4.696254-3.865377 4.298878-4.298879 4.009878-4.551753 3.648627-4.840753 3.215128-4.949129 2.817752-5.346504 2.528752-5.491004 2.023001-5.635504 1.589501-5.780004 1.228251-5.88838 0.794751-6.032879 0.252875-6.285755-0.252875-6.177379-0.686376-6.430255-1.192126-6.430255-1.734001-6.430254-2.275876-6.430255-2.709377-6.430255-3.323503-6.53863-3.901503-6.430254-4.551753-4.154378-5.888379-3.757003-5.924505-3.215127-5.888379-2.817753-5.888379-2.420376-6.03288-2.023002-5.924504-1.589501-5.888379-1.192126-5.88838-0.686375-5.924504-0.397376-5.743879 0.1445-5.780005 0.397376-5.635504 0.79475-5.491004 1.336626-5.382629 1.625627-5.202003 1.986876-5.093629 2.420377-4.985254 2.673252-4.696253 3.070627-4.551754 3.648628-4.407253 3.720877-4.009878 4.298879-3.901503 4.551753-3.612502 4.840753-3.359628 5.346504-3.106752 5.491004-2.781627 5.88838-2.420377 6.321879-2.275876 6.430255-1.770127 6.936005-1.481126 7.26113-1.047626 7.514006-0.686375 10.042757-8.706132-66.072673-80.594934 76.765681-78.969307 14.08876 12.752134 14.305511 12.318634 14.630636 11.921259 14.847385 11.415508 15.136387 10.982008 15.425386 10.476258 15.678261 9.898257 15.931137 9.392507 16.220137 8.850631 16.328512 8.308756 16.509137 7.658506 16.725887 6.97213 17.014888 6.430255 17.159387 5.635504 17.267763 5.093629 17.412263 4.298878 17.701263 3.757003 17.665138 2.817752 17.954138 2.131376 17.954138 1.336626 18.098638 0.686376 18.207013-0.289 18.351514-1.047626 18.387638-2.023002 18.351514-2.673252 18.459888-3.757002 18.496014-4.551754 18.640513-5.491004 18.604389-6.466379 18.640514-7.514006 18.604388-8.417131 18.496014-9.392507-329.026741-318.983984-90.709942 94.50307-146.017356-146.414733 250.635433-265.338319 5.780004 1.336626 5.635504 1.192126 5.59938 1.083751 5.635504 0.79475 5.491004 0.939251 5.491004 0.541875 5.491004 0.541876 5.382629 0.252875 5.346504 0.1445h5.202003l5.238129-0.1445 5.238129-0.1445 5.093629-0.505751 5.093629-0.686375 5.093628-0.650251 4.949129-0.93925 4.949129-1.228251 4.804628-1.192126 4.985254-1.481126 4.696253-1.481126 4.660129-1.878502 4.696253-1.986876 4.696253-2.167502 4.407254-2.275876 4.551753-2.528752 4.443378-2.709377 4.407254-2.926127 4.298878-3.106753 4.262753-3.215127 4.298878-3.468002 4.046003-3.648628 4.118253-3.865378 79.330558 81.389685-126.076342 135.143724 335.890496 334.011994 10.295632-19.435264 8.995132-20.26614 7.47788-21.169265 6.17738-21.855641 4.949128-22.542017 3.468003-23.047767 2.312002-23.589642 0.93925-24.023143-0.4335-24.239892-1.589501-24.565018-2.817752-24.781768-4.154378-24.962394-5.238129-24.781768-6.53863-24.817893-7.766881-24.817893-8.850631-24.528893-10.042757-24.276018-11.271009-23.878642-12.318634-23.445143-13.402384-22.939391-14.594511-22.253017-15.678262-21.711141-16.762012-20.91639-17.809638-20.12164-18.748889-19.182389-19.977139-18.243138-20.735766-17.159388-21.855641-16.075636-22.903266-14.739011-23.842518-13.546885-24.781768-12.210259L513.697876 0z" fill="#ffd700"/></svg>
        <div class="header-title">
          <h1>党政软件版本管控平台</h1>
        </div>
      </div>
      <div class="header-right">
        <el-badge :value="noticeCount" :hidden="noticeCount === 0" class="notice-badge">
          <el-button class="header-btn" @click="showNoticeDialog = true; loadNotices()">
            <el-icon class="btn-icon"><Bell /></el-icon>
            <span class="btn-text">通知</span>
          </el-button>
        </el-badge>
        <el-dropdown @command="handleUserCommand">
          <div class="user-info">
            <div class="user-avatar">
              <span>{{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}</span>
              <!-- 手机端未读消息黄色警示点 -->
              <span v-if="isMobile && noticeCount > 0" class="mobile-notify-dot"></span>
            </div>
            <div class="user-details">
              <span class="username">{{ userStore.username }}</span>
              <span class="user-role">{{ userStore.roleName }}</span>
            </div>
            <el-icon class="dropdown-arrow"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="profile"><el-icon><User /></el-icon> 个人中心</el-dropdown-item>
              <el-dropdown-item command="settings"><el-icon><Setting /></el-icon> 系统设置</el-dropdown-item>
              <el-dropdown-item command="messages">
                <el-icon><Bell /></el-icon> 消息中心
                <el-badge v-if="noticeCount > 0" :value="noticeCount" class="dropdown-msg-badge" />
              </el-dropdown-item>
              <el-dropdown-item divided command="logout"><el-icon><SwitchButton /></el-icon> 退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <!-- 手机端标题栏（党徽居中 + 红色标题） -->
    <div v-if="isMobile" class="mobile-title-bar">
      <span class="mobile-title-text">党政软件版本管控平台</span>
      <svg class="mobile-emblem" viewBox="0 0 1024 1024" width="28" height="28"><path d="M513.697876 0l40.17103 2.817752 38.870528 5.346504 37.244902 7.911381 35.763777 10.331757 34.174275 12.607635 32.657024 14.73901 30.959147 16.906513 29.333522 18.496013 27.74402 20.663515 25.865519 22.108517 24.239893 23.625767 22.361391 25.070768 20.663515 26.551895 18.857264 27.59952 16.906512 28.719396 14.991886 29.622522 13.113385 30.417272 11.126508 31.248148 9.139632 31.645523 7.080505 32.187399 5.093629 32.584773 2.962252 32.83765 0.903126 32.873774-1.336626 32.837649-3.323503 32.729274-5.780004 32.584773-7.911381 32.042899-10.151132 31.645523-12.463134 30.959148-14.739011 30.164397-17.303888 29.369646-19.543639 28.430396 92.552318 88.217315-124.161716 129.688845-91.107317-90.240316-19.146264 11.523883-19.182389 10.873633-19.290764 10.042758-19.290764 9.248006-19.290765 8.561632-19.435264 7.803005-19.399139 7.11663-19.435264 6.285755-19.579765 5.346504-19.399139 4.840754-19.579764 3.901502-19.543639 3.215128-19.68814 2.420377-19.579764 1.589501-19.543639 0.686375-19.579765 0.108375-19.543639-0.79475-19.435264-1.589501-19.579765-2.420377-19.543639-3.106753-19.435264-4.009877-19.54364-4.840754-19.435264-5.491004-19.290764-6.430255-19.290764-7.225005-19.290764-8.200381-19.290764-8.706131-19.146264-9.789883-19.037889-10.584632-19.037889-11.415509-19.001764-12.210259-18.893389-12.968884-14.08876 13.79976 0.93925 7.622381 0.397376 7.26113v7.225005l-0.505751 6.863755-0.93925 6.68313-1.481126 6.32188-1.878502 6.141254-2.131376 5.924505-2.564877 5.635504-3.070628 5.346504-3.359627 4.949128-3.612503 4.696254-3.865377 4.298878-4.298879 4.009878-4.551753 3.648627-4.840753 3.215128-4.949129 2.817752-5.346504 2.528752-5.491004 2.023001-5.635504 1.589501-5.780004 1.228251-5.88838 0.794751-6.032879 0.252875-6.285755-0.252875-6.177379-0.686376-6.430255-1.192126-6.430255-1.734001-6.430254-2.275876-6.430255-2.709377-6.430255-3.323503-6.53863-3.901503-6.430254-4.551753-4.154378-5.888379-3.757003-5.924505-3.215127-5.888379-2.817753-5.888379-2.420376-6.03288-2.023002-5.924504-1.589501-5.888379-1.192126-5.88838-0.686375-5.924504-0.397376-5.743879 0.1445-5.780005 0.397376-5.635504 0.79475-5.491004 1.336626-5.382629 1.625627-5.202003 1.986876-5.093629 2.420377-4.985254 2.673252-4.696253 3.070627-4.551754 3.648628-4.407253 3.720877-4.009878 4.298879-3.901503 4.551753-3.612502 4.840753-3.359628 5.346504-3.106752 5.491004-2.781627 5.88838-2.420377 6.321879-2.275876 6.430255-1.770127 6.936005-1.481126 7.26113-1.047626 7.514006-0.686375 10.042757-8.706132-66.072673-80.594934 76.765681-78.969307 14.08876 12.752134 14.305511 12.318634 14.630636 11.921259 14.847385 11.415508 15.136387 10.982008 15.425386 10.476258 15.678261 9.898257 15.931137 9.392507 16.220137 8.850631 16.328512 8.308756 16.509137 7.658506 16.725887 6.97213 17.014888 6.430255 17.159387 5.635504 17.267763 5.093629 17.412263 4.298878 17.701263 3.757003 17.665138 2.817752 17.954138 2.131376 17.954138 1.336626 18.098638 0.686376 18.207013-0.289 18.351514-1.047626 18.387638-2.023002 18.351514-2.673252 18.459888-3.757002 18.496014-4.551754 18.640513-5.491004 18.604389-6.466379 18.640514-7.514006 18.604388-8.417131 18.496014-9.392507-329.026741-318.983984-90.709942 94.50307-146.017356-146.414733 250.635433-265.338319 5.780004 1.336626 5.635504 1.192126 5.59938 1.083751 5.635504 0.79475 5.491004 0.939251 5.491004 0.541875 5.491004 0.541876 5.382629 0.252875 5.346504 0.1445h5.202003l5.238129-0.1445 5.238129-0.1445 5.093629-0.505751 5.093629-0.686375 5.093628-0.650251 4.949129-0.93925 4.949129-1.228251 4.804628-1.192126 4.985254-1.481126 4.696253-1.481126 4.660129-1.878502 4.696253-1.986876 4.696253-2.167502 4.407254-2.275876 4.551753-2.528752 4.443378-2.709377 4.407254-2.926127 4.298878-3.106753 4.262753-3.215127 4.298878-3.468002 4.046003-3.648628 4.118253-3.865378 79.330558 81.389685-126.076342 135.143724 335.890496 334.011994 10.295632-19.435264 8.995132-20.26614 7.47788-21.169265 6.17738-21.855641 4.949128-22.542017 3.468003-23.047767 2.312002-23.589642 0.93925-24.023143-0.4335-24.239892-1.589501-24.565018-2.817752-24.781768-4.154378-24.962394-5.238129-24.781768-6.53863-24.817893-7.766881-24.817893-8.850631-24.528893-10.042757-24.276018-11.271009-23.878642-12.318634-23.445143-13.402384-22.939391-14.594511-22.253017-15.678262-21.711141-16.762012-20.91639-17.809638-20.12164-18.748889-19.182389-19.977139-18.243138-20.735766-17.159388-21.855641-16.075636-22.903266-14.739011-23.842518-13.546885-24.781768-12.210259L513.697876 0z" fill="#ffd700"/></svg>
      <span class="mobile-title-text">党政软件版本管控平台</span>
    </div>

    <!-- 主体区域 -->
    <div class="app-body" :style="{ paddingLeft: sidebarWidth }">
      <!-- 侧边栏 -->
      <aside class="gov-sidebar" :style="{ width: sidebarWidth }">
        <el-menu
          :default-active="$route.path"
          :collapse="sidebarCollapsed"
          router
          class="sidebar-menu"
          background-color="#ffffff"
          text-color="#303133"
          active-text-color="#ffffff"
          @mousemove="onMenuMousemove"
        >
          <el-menu-item index="/dashboard">
            <el-icon class="menu-icon"><HomeFilled /></el-icon>
            <template #title>工作台</template>
          </el-menu-item>

          <!-- v-show 保持 DOM 结构稳定，只切换显隐，角色未加载时 userStore.userInfo 为 null 全部隐藏 -->
          <el-sub-menu index="repositories" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><Folder /></el-icon>
              <span>仓库管理</span>
            </template>
            <el-menu-item index="/repos">仓库列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="branches" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><Share /></el-icon>
              <span>分支管理</span>
            </template>
            <el-menu-item index="/branches">分支列表</el-menu-item>
            <el-menu-item index="/branches/merge">合并请求</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="versions" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><Collection /></el-icon>
              <span>版本管理</span>
            </template>
            <el-menu-item index="/versions">版本列表</el-menu-item>
            <el-menu-item index="/versions/baseline">基线管理</el-menu-item>
            <el-menu-item index="/versions/archive">归档管理</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="approval" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><DocumentChecked /></el-icon>
              <span>审批管理</span>
            </template>
            <el-menu-item index="/approval/pending" v-show="userStore.role === 'admin' || userStore.role === 'project_manager'">待我审批</el-menu-item>
            <el-menu-item index="/approval/my-requests">我的申请</el-menu-item>
            <el-menu-item index="/approval/history">审批历史</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="audit" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.isAuditor)">
            <template #title>
              <el-icon class="menu-icon"><Search /></el-icon>
              <span>审计管理</span>
            </template>
            <el-menu-item index="/audit/logs">操作日志</el-menu-item>
            <el-menu-item index="/audit/reports">审计报表</el-menu-item>
            <el-menu-item index="/audit/warning">风险预警</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="admin" v-show="userStore.userInfo && userStore.hasPermission('admin:manage')">
            <template #title>
              <el-icon class="menu-icon"><Setting /></el-icon>
              <span>系统管理</span>
            </template>
            <el-menu-item index="/admin/users">用户管理</el-menu-item>
            <el-menu-item index="/admin/roles">角色权限</el-menu-item>
            <el-menu-item index="/admin/depts">部门管理</el-menu-item>
            <!-- <el-menu-item index="/admin/backup">备份管理</el-menu-item> -->
          </el-sub-menu>
        </el-menu>

        <!-- 侧边栏折叠按钮（固定在功能栏底部，菜单滚动时不随之移动） -->
        <div class="sidebar-toggle" @click="sidebarCollapsed = !sidebarCollapsed">
          <el-icon><DArrowRight v-if="sidebarCollapsed" /><DArrowLeft v-else /></el-icon>
        </div>
      </aside>

      <!-- 移动端抽屉导航 -->
      <el-drawer
        v-model="mobileDrawerVisible"
        direction="ltr"
        size="240px"
        :show-close="true"
      >
        <template #header>
          <span style="font-weight:600;color:#c62828;">导航菜单</span>
        </template>
        <el-menu
          :default-active="$route.path"
          router
          class="drawer-menu"
          background-color="#ffffff"
          text-color="#303133"
          active-text-color="#ffffff"
          @select="onDrawerSelect"
        >
          <el-menu-item index="/dashboard">
            <el-icon class="menu-icon"><HomeFilled /></el-icon>
            <template #title>工作台</template>
          </el-menu-item>

          <el-sub-menu index="repositories-m" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><Folder /></el-icon>
              <span>仓库管理</span>
            </template>
            <el-menu-item index="/repos">仓库列表</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="branches-m" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><Share /></el-icon>
              <span>分支管理</span>
            </template>
            <el-menu-item index="/branches">分支列表</el-menu-item>
            <el-menu-item index="/branches/merge">合并请求</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="versions-m" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><Collection /></el-icon>
              <span>版本管理</span>
            </template>
            <el-menu-item index="/versions">版本列表</el-menu-item>
            <el-menu-item index="/versions/baseline">基线管理</el-menu-item>
            <el-menu-item index="/versions/archive">归档管理</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="approval-m" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.role === 'project_manager' || userStore.role === 'developer')">
            <template #title>
              <el-icon class="menu-icon"><DocumentChecked /></el-icon>
              <span>审批管理</span>
            </template>
            <el-menu-item index="/approval/pending" v-show="userStore.role === 'admin' || userStore.role === 'project_manager'">待我审批</el-menu-item>
            <el-menu-item index="/approval/my-requests">我的申请</el-menu-item>
            <el-menu-item index="/approval/history">审批历史</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="audit-m" v-show="userStore.userInfo && (userStore.role === 'admin' || userStore.isAuditor)">
            <template #title>
              <el-icon class="menu-icon"><Search /></el-icon>
              <span>审计管理</span>
            </template>
            <el-menu-item index="/audit/logs">操作日志</el-menu-item>
            <el-menu-item index="/audit/reports">审计报表</el-menu-item>
            <el-menu-item index="/audit/warning">风险预警</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="admin-m" v-show="userStore.userInfo && userStore.hasPermission('admin:manage')">
            <template #title>
              <el-icon class="menu-icon"><Setting /></el-icon>
              <span>系统管理</span>
            </template>
            <el-menu-item index="/admin/users">用户管理</el-menu-item>
            <el-menu-item index="/admin/roles">角色权限</el-menu-item>
            <el-menu-item index="/admin/depts">部门管理</el-menu-item>
          </el-sub-menu>
        </el-menu>
      </el-drawer>

      <!-- 主内容区 -->
      <main class="app-main">
        <div class="main-content">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>

        <!-- 底部版权（属于右侧主体内容） -->
        <footer class="gov-footer">
          <p>党政软件版本管控平台 © 2026 版权所有 | 技术支持：电科院52组</p>
        </footer>
      </main>
    </div>

    <!-- 通知弹窗 -->
    <el-dialog v-model="showNoticeDialog" title="系统通知" width="650px">
      <div class="notice-list">
        <el-empty v-if="notices.length === 0" description="暂无通知" />
        <template v-else>
          <div v-for="notice in pagedNotices" :key="notice.id" class="notice-item" :class="{ 'notice-unread': !notice.read }">
            <div class="notice-header">
              <div class="notice-title">
                <span v-if="!notice.read" class="unread-dot"></span>
                {{ notice.title }}
              </div>
              <el-tag v-if="notice.isSys" size="small" type="info">系统通知</el-tag>
              <el-tag v-else size="small" type="warning">审批通知</el-tag>
            </div>
            <div class="notice-content">{{ notice.content }}</div>
            <div class="notice-footer">
              <span class="notice-time">{{ notice.createTime }}</span>
              <el-button type="primary" link size="small" @click="viewNoticeDetail(notice)">查看详情</el-button>
              <el-button v-if="notice.isSys && !notice.read" type="primary" link size="small" @click="handleSysNotice(notice)">标记已读</el-button>
              <el-button v-else-if="notice.isSys && notice.read" type="success" link size="small" disabled>已读</el-button>
              <el-button v-else type="warning" link size="small" @click="handleApprovalNotice(notice)">去审批</el-button>
            </div>
          </div>
          <!-- 分页 -->
          <div class="notice-pagination" v-if="notices.length > noticePageSize">
            <el-pagination
              v-model:current-page="noticePage"
              :page-size="noticePageSize"
              :total="notices.length"
              layout="prev, pager, next"
              size="small"
              background
            />
          </div>
        </template>
      </div>
    </el-dialog>

    <!-- 通知详情弹窗 -->
    <el-dialog v-model="showDetailDialog" title="通知详情" width="500px">
      <div v-if="detailNotice" class="notice-detail">
        <div class="detail-header">
          <h3>{{ detailNotice.title }}</h3>
          <el-tag v-if="detailNotice.isSys" size="small" type="info">系统通知</el-tag>
          <el-tag v-else size="small" type="warning">审批通知</el-tag>
        </div>
        <el-divider />
        <div class="detail-body">{{ detailNotice.content }}</div>
        <el-divider />
        <div class="detail-time">发布时间：{{ detailNotice.createTime }}</div>
      </div>
    </el-dialog>
  </div>

  <!-- 未登录显示登录页 -->
  <router-view v-else />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bell, User, Setting, SwitchButton, HomeFilled, Folder, Share, Collection, DocumentChecked, Search, DArrowRight, DArrowLeft, ArrowDown, Platform, Operation } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { useResponsive } from '@/composables/useResponsive'
import request from '@/api'
import { markNotificationRead } from '@/api/bff'


const router = useRouter()
const userStore = useUserStore()

const { isMobile, isTablet } = useResponsive()
const sidebarCollapsed = ref(false)
const sidebarWidth = computed(() => {
  if (isMobile.value) return '0px'
  if (isTablet.value) return '64px'
  return sidebarCollapsed.value ? '64px' : '220px'
})
const mobileDrawerVisible = ref(false)
const showNoticeDialog = ref(false)
const showDetailDialog = ref(false)
const noticeCount = ref(0)
const notices = ref([])
const detailNotice = ref(null)
const noticePage = ref(1)
const noticePageSize = 10
let noticeTimer = null

onMounted(async () => {
  await userStore.initUser()
  loadNoticeCount()
  // 每 15 秒轮询一次通知数
  noticeTimer = setInterval(loadNoticeCount, 15000)
  // 折叠弹出菜单的鼠标追踪悬停动画
  document.addEventListener('mousemove', onPopupMousemove, { passive: true })
})

onUnmounted(() => {
  if (noticeTimer) clearInterval(noticeTimer)
  document.removeEventListener('mousemove', onPopupMousemove)
})

// 菜单项悬停动画 — 鼠标位置追踪，浅红色从鼠标中心向四周辐射渐变
function onMenuMousemove(e) {
  const item = e.target.closest('.el-menu-item, .el-sub-menu__title')
  if (!item) return
  const rect = item.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * 100
  const y = ((e.clientY - rect.top) / rect.height) * 100
  item.style.setProperty('--mx', `${x}%`)
  item.style.setProperty('--my', `${y}%`)
}

// 移动端抽屉菜单选中后自动关闭
function onDrawerSelect() {
  mobileDrawerVisible.value = false
}

// 折叠状态下弹出子菜单的悬停动画（popup 渲染在组件外部，需全局监听）
function onPopupMousemove(e) {
  const item = e.target.closest('.el-menu--popup .el-menu-item, .el-menu--popup .el-sub-menu__title')
  if (!item) return
  const rect = item.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * 100
  const y = ((e.clientY - rect.top) / rect.height) * 100
  item.style.setProperty('--mx', `${x}%`)
  item.style.setProperty('--my', `${y}%`)
}

async function loadNoticeCount() {
  try {
    const res = await request.get('/notifications/count')
    noticeCount.value = (res.data || res)?.count || 0
  } catch (_) { noticeCount.value = 0 }
}

async function loadNotices() {
  const all = []
  // 加载全部通知（含已读，便于展示历史）
  try {
    const sysRes = await request.get('/notifications', { params: { page: 1, pageSize: 200 } })
    const sysList = (sysRes.data || sysRes)?.list || []
    for (const item of sysList) {
      all.push({
        id: 'sys_' + item.notification_id,
        title: item.title || '系统通知',
        content: item.content || '',
        createTime: item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '',
        _ts: item.created_at ? new Date(item.created_at).getTime() : 0,  // 排序用时间戳
        isSys: true,
        notiId: item.notification_id,
        read: item.is_read === true || item.is_read === 'true'
      })
    }
  } catch (_) { /* ignore */ }
  // 审批通知（待我审批）
  try {
    const pendRes = await request.get('/approvals/pending', { params: { page: 1, pageSize: 100 } })
    const pendList = (pendRes.data || pendRes)?.list || []
    const stepNames = ['', '待项目管理员审批', '待系统管理员审批']
    const typeMap = { version_release: '版本发布', baseline_create: '基线申请', baseline_change: '基线变更', baseline_freeze: '基线冻结', baseline_archive: '基线归档', merge: '合并请求' }
    for (const item of pendList) {
      all.push({
        id: 'pend_' + item.approval_id,
        title: item.title,
        content: (typeMap[item.operation_type] || item.operation_type) + ' | ' + (stepNames[item.current_step] || '待审批') + ' | 申请人: ' + item.applicant_username,
        createTime: item.created_at ? new Date(item.created_at).toLocaleString('zh-CN') : '',
        _ts: item.created_at ? new Date(item.created_at).getTime() : 0,
        isSys: false,
        approvalId: item.approval_id,
        read: false  // 审批通知始终显示为未读状态
      })
    }
  } catch (_) { /* ignore */ }
  // ★ 按时间倒序排列（最新在最前面）
  all.sort((a, b) => b._ts - a._ts)
  notices.value = all
  noticePage.value = 1  // 重置到第一页
}

// 当前分页显示的通知
const pagedNotices = computed(() => {
  const start = (noticePage.value - 1) * noticePageSize
  return notices.value.slice(start, start + noticePageSize)
})

function handleUserCommand(command) {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'settings':
      router.push('/settings')
      break
    case 'messages':
      showNoticeDialog.value = true
      loadNotices()
      break
    case 'logout':
      ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(async () => {
        await userStore.logout()
        router.push('/login')
        ElMessage.success('已安全退出')
      }).catch(() => {})
      break
  }
}

function viewNoticeDetail(notice) {
  detailNotice.value = notice
  showDetailDialog.value = true
  // 系统通知查看详情后自动标记已读
  if (notice.isSys && !notice.read && notice.notiId) {
    markNotificationRead(notice.notiId).then(() => {
      notice.read = true
      loadNoticeCount()
    }).catch(_ => {})
  }
}

async function handleSysNotice(notice) {
  if (notice.notiId) {
    try {
      await markNotificationRead(notice.notiId)
      ElMessage.success('已标记为已读')
    } catch {
      ElMessage.warning('操作失败')
    }
  }
  notice.read = true
  loadNoticeCount()
}

function handleApprovalNotice(notice) {
  showNoticeDialog.value = false
  if (notice?.approvalId) {
    router.push({ path: '/approval/pending', query: { highlight: notice.approvalId } })
  } else {
    router.push('/approval/pending')
  }
}
</script>

<style lang="scss" scoped>
.app-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

/* 顶部导航 */
.gov-header {
  height: 64px;
  background: linear-gradient(90deg, #c41230 0%, #8b0000 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 100;

  .header-left {
    display: flex;
    align-items: center;
    gap: 15px;

    .header-emblem {
      width: 44px;
      height: 44px;
    }

    .header-title {
      h1 {
        font-size: 20px;
        font-weight: 600;
        color: #fff;
        letter-spacing: 1px;
      }

      .header-subtitle {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.8);
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 15px;

    .header-btn {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: #fff;
      padding: 8px 15px;

      .btn-icon {
        margin-right: 5px;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 5px 15px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.1);
      transition: background 0.3s;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      .user-avatar {
        position: relative;
        width: 36px;
        height: 36px;
        background: #ffd700;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        color: #8b0000;

        /* 手机端未读消息黄色警示点 */
        .mobile-notify-dot {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 11px;
          height: 11px;
          border-radius: 50%;
          background: #ffd700;
          border: 2px solid #c62828;
          z-index: 2;
          animation: notify-pulse 2s infinite;
        }
      }

      @keyframes notify-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.6); }
        50% { box-shadow: 0 0 0 6px rgba(255, 215, 0, 0); }
      }

      .user-details {
        display: flex;
        flex-direction: column;

        .username {
          color: #fff;
          font-size: 14px;
          font-weight: 500;
        }

        .user-role {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }
      }

      .dropdown-arrow {
        color: rgba(255, 255, 255, 0.7);
        font-size: 10px;
      }
    }
  }
}

/* 手机端标题栏（党徽居中 + 红色标题，仅手机端显示） */
.mobile-title-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 12px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;

  .mobile-title-text {
    font-size: 14px;
    font-weight: 700;
    color: #c62828;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  .mobile-emblem {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
  }
}

/* 主体区域 */
.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  transition: padding-left 0.3s ease;
}

/* 侧边栏 — 固定在屏幕左侧，不随页面滚动 */
.gov-sidebar {
  position: fixed;
  top: 64px;
  left: 0;
  height: calc(100vh - 64px);
  background: #ffffff;
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow: visible;
  border-right: 1px solid #e4e7ed;
  z-index: 99;

  .sidebar-menu {
    flex: 1;
    border-right: none;
    overflow-y: auto;
    overflow-x: hidden;
    // 底部留出空间给固定的折叠按钮，避免最后一项被完全遮挡
    padding-bottom: 44px;

    &:not(.el-menu--collapse) {
      width: 100%;
    }

    .menu-icon {
      font-size: 16px;
      width: 20px;
      text-align: center;
    }

    // 非折叠状态下图标与文字间距
    &:not(.el-menu--collapse) .menu-icon {
      margin-right: 10px;
    }

    // 折叠状态下菜单项图标居中
    &.el-menu--collapse :deep(.el-menu-item),
    &.el-menu--collapse :deep(.el-sub-menu__title) {
      justify-content: center;
      padding: 0 !important;

      .menu-icon {
        margin-right: 0;
      }
    }

    // 菜单项悬停动画：浅红色从鼠标中心向四周辐射渐变，边缘保留最浅的浅红色
    :deep(.el-sub-menu__title),
    :deep(.el-menu-item) {
      position: relative;
      // 默认鼠标位置在中心
      --mx: 50%;
      --my: 50%;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(
          circle at var(--mx) var(--my),
          rgba(198, 40, 40, 0.12) 0%,
          rgba(198, 40, 40, 0.06) 35%,
          rgba(198, 40, 40, 0.02) 70%,
          rgba(198, 40, 40, 0.008) 100%
        );
        opacity: 0;
        transition: opacity 0.25s ease;
        pointer-events: none;
        z-index: 0;
      }

      &:hover::before {
        opacity: 1;
      }

      // 确保文字在伪元素之上，同时保留子菜单箭头的绝对定位
      > :not(.el-sub-menu__icon-arrow) {
        position: relative;
        z-index: 1;
      }
    }

    :deep(.el-sub-menu__title) {
      color: #303133;
      &:hover {
        background: transparent !important;
        color: #c62828 !important;
      }
    }

    :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
      color: #c62828 !important;
    }

    :deep(.el-menu-item) {
      color: #303133;
      &:hover {
        background: transparent !important;
        color: #c62828 !important;
      }

      &.is-active {
        background: #c62828 !important;
        color: #ffffff !important;
      }
    }
  }

  // 折叠按钮 — 固定在功能栏底部，菜单在其下方滚动
  .sidebar-toggle {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #909399;
    cursor: pointer;
    background: #fff;
    border-top: 1px solid #ebeef5;
    transition: color 0.3s ease, background 0.3s ease;
    font-size: 14px;
    z-index: 10;
    flex-shrink: 0;

    // 渐变遮罩层：菜单项向下滚动时从按钮底部逐渐浮现
    &::before {
      content: '';
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      height: 28px;
      background: linear-gradient(to bottom, transparent 0%, rgba(255, 255, 255, 0.7) 40%, #ffffff 100%);
      pointer-events: none;
    }

    &:hover {
      background: #ffebee;
      color: #c62828;
    }

    .el-icon {
      transition: transform 0.3s ease;
    }
  }
}

/* 主内容区 — 右侧独立滚动，包含版权栏 */
.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
  min-width: 0;
  background: #f5f5f5;

  .main-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
  }
}

/* 底部版权 — 属于右侧主体内容底部 */
.gov-footer {
  flex-shrink: 0;
  background: #fff;
  color: #666;
  padding: 16px 20px;
  text-align: center;
  font-size: 13px;
  border-top: 1px solid #e4e7ed;
}

.notice-badge {
  :deep(.el-badge__content) {
    background: #ffd700;
    color: #333;
  }
}

/* 下拉菜单中消息中心的未读计数徽标 */
.dropdown-msg-badge {
  margin-left: 8px;
  :deep(.el-badge__content) {
    background: #c62828;
    color: #fff;
    font-size: 11px;
    height: 18px;
    line-height: 18px;
    padding: 0 5px;
  }
}

.notice-list {
  .notice-item {
    padding: 15px;
    border-bottom: 1px solid #eee;

    .notice-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;

      .notice-title {
        font-weight: 600;
        color: #333;
      }
    }

    .notice-content {
      color: #666;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .notice-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .notice-time {
        color: #999;
        font-size: 12px;
      }
    }
  }
  // 未读通知高亮
  .notice-unread {
    background: #f0f7ff;
  }
  // 未读标记点
  .unread-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #409eff;
    margin-right: 6px;
    vertical-align: middle;
  }
  // 分页
  .notice-pagination {
    padding: 12px 0;
    display: flex;
    justify-content: center;
  }
}

.notice-detail {
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    h3 { margin: 0; font-size: 16px; color: #333; }
  }
  .detail-body {
    font-size: 14px;
    color: #555;
    line-height: 1.8;
    white-space: pre-wrap;
  }
  .detail-time {
    font-size: 12px;
    color: #999;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ============ 响应式 ============ */
/* 汉堡菜单按钮 — 默认隐藏，手机端显示 */
.hamburger-btn {
  display: none;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  padding: 6px 8px;
  min-width: auto;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
}

@media (max-width: 768px) {
  .gov-header {
    padding: 0 12px;

    .header-left {
      gap: 10px;
    }

    /* 手机端 Header 中隐藏党徽和标题（已移至 mobile-title-bar） */
    .header-emblem-svg {
      display: none;
    }

    .header-title {
      display: none;
    }
  }

  .hamburger-btn {
    display: inline-flex;
  }

  .header-btn .btn-text {
    display: none;
  }

  .user-details {
    display: none;
  }

  /* 手机端隐藏通知铃铛按钮 */
  .notice-badge {
    display: none !important;
  }

  .gov-sidebar {
    display: none;
  }

  .app-body {
    padding-left: 0 !important;
  }

  .app-main .main-content {
    padding: 12px;
  }

  .gov-footer {
    padding: 10px 12px;
    font-size: 11px;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .gov-header {
    padding: 0 16px;

    .header-title h1 {
      font-size: 17px;
    }
  }

  .app-main .main-content {
    padding: 16px;
  }
}

/* 抽屉菜单样式 */
.drawer-menu {
  border-right: none;

  .menu-icon {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }

  :deep(.el-menu-item.is-active) {
    background: #c62828 !important;
    color: #ffffff !important;
  }
}
</style>

<!-- 折叠弹出子菜单的悬停动画（全局样式，popup 渲染在组件外部） -->
<style lang="scss">
.el-menu--popup {
  .el-menu-item,
  .el-sub-menu__title {
    position: relative;
    --mx: 50%;
    --my: 50%;

    // 去掉 Element Plus 默认灰色背景
    &:hover {
      background: transparent !important;
    }

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(
        circle at var(--mx) var(--my),
        rgba(198, 40, 40, 0.12) 0%,
        rgba(198, 40, 40, 0.06) 35%,
        rgba(198, 40, 40, 0.02) 70%,
        rgba(198, 40, 40, 0.008) 100%
      );
      opacity: 0;
      transition: opacity 0.25s ease;
      pointer-events: none;
      z-index: 0;
    }

    &:hover::before {
      opacity: 1;
    }

    // 确保文字在伪元素之上
    > :not(.el-sub-menu__icon-arrow) {
      position: relative;
      z-index: 1;
    }
  }

  // 弹出菜单中当前激活项：深红文字 + 浅红背景，避免白字看不见
  .el-menu-item.is-active {
    color: #c62828 !important;
    background: #ffebee !important;
  }
}
</style>
