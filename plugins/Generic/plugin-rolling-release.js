/**
 * TODO: 更新失败的回滚操作
 */

/* 触发器 手动触发 */
const onRun = async () => {
  await Rolling()
}

/* 触发器 启动APP时 */
const onStartup = async () => {
  if (Plugin.AutoRollingMode === 'onStartup') {
    // 延迟检测，确保内核已经启动
    setTimeout(() => Rolling(false), (Plugin.AutoRollingDelay || 10) * 1000)
  }
}

/* 触发器 APP就绪后 */
const onReady = async () => {
  if (Plugin.AutoRollingMode === 'onReady') {
    // 延迟检测，确保内核已经启动
    setTimeout(() => Rolling(false), (Plugin.AutoRollingDelay || 10) * 1000)
  }
}

/*
 * 右键菜单 - 滚动版本
 * params: confirm 是否进行交互式确认
 */
const Rolling = async (confirm = true) => {
  await checkRollingReleaseEnabled()
  await checkLatestVersion()

  const GFC_URL = 'https://api.github.com/repos/GUI-for-Cores/GUI.for.Clash/releases/tags/rolling-release'
  const GFS_URL = 'https://api.github.com/repos/Obscur0/GUI.for.SingBox/releases/tags/rolling-release'
  const url = Plugins.APP_TITLE.includes('Clash') ? GFC_URL : GFS_URL

  const { update, destroy, error } = Plugins.message.info(`[${Plugin.name}] Тестирование...`, 999999)

  const { body } = await Plugins.HttpGet(url, {
    Authorization: Plugins.getGitHubApiAuthorization()
  })

  if (body.message) {
    destroy()
    throw body.message
  }

  const ZipFile = 'data/.cache/rolling-release.zip'
  const BackupFile = 'data/.cache/rolling-release.backup'
  const ZipUrl = body.assets.find((v) => v.name === 'rolling-release.zip')?.browser_download_url
  const VersionUrl = body.assets.find((v) => v.name === 'version.txt')?.browser_download_url
  const ChangelogUrl = body.assets.find((v) => v.name === 'changelog.md')?.browser_download_url

  if (!ZipUrl || !VersionUrl) {
    destroy()
    throw 'Произошли некоторые ошибки, и не удалось найти пакет ресурсов для обновления'
  }

  let localVersion = ''
  let remoteVersion = ''

  try {
    const { body } = await Plugins.HttpGet(VersionUrl)
    remoteVersion = body

    const res = await fetch('/version.txt')
    localVersion = await res.text()
  } catch (err) {}

  if (!remoteVersion) {
    destroy()
    throw 'Не удается получить информацию об удаленной версии'
  }

  if (localVersion === remoteVersion) {
    Plugins.message.success(`[${Plugin.name}] Текущая версия является актуальной`)
    destroy()
    return
  }

  let changelog = 'Обновления обслуживания'

  if (ChangelogUrl && confirm) {
    update('Получение журнала обновлений...')
    const { body } = await Plugins.HttpGet(ChangelogUrl)
    changelog = body
  }
  destroy()

  confirm && (await Plugins.confirm(Plugin.name, changelog, { type: 'markdown' }))

  const { update: update2, destroy: destroy2 } = Plugins.message.info('Обновление...')
  try {
    await Plugins.Download(ZipUrl, ZipFile, {}, (progress, total) => {
      update2('Обновление...' + ((progress / total) * 100).toFixed(2) + '%')
    })
    await Plugins.ignoredError(Plugins.Movefile, 'data/rolling-release', BackupFile)
    await Plugins.UnzipZIPFile(ZipFile, 'data')
    await Plugins.Removefile(ZipFile)
    await Plugins.Removefile(BackupFile)
    destroy2()
    const ok = await Plugins.confirm(Plugin.name, 'Обновление прошло успешно, нужно ли перезагрузить интерфейс?').catch(() => 0)
    ok && Plugins.WindowReloadApp()
  } catch (err) {
    error(err.message || err)
  } finally {
    Plugins.sleep(1500).then(() => destroy2())
  }
}

/**
 * 右键菜单 - 恢复版本
 */
const Recovery = async () => {
  await checkRollingReleaseEnabled()
  if (!(await Plugins.FileExists('data/rolling-release'))) {
    Plugins.message.info('Восстанавливать не нужно, эта версия уже установлена по умолчанию.')
    return
  }
  await Plugins.confirm(Plugin.name, 'Удаляете ли вы текущую версию и восстанавливаете ли ее до версии по умолчанию?\nЭто приведет к удалению каталога data/rolling-release.')
  await Plugins.Removefile('data/rolling-release')
  const ok = await Plugins.confirm(Plugin.name, 'Восстановление прошло успешно, нужно ли перезагрузить интерфейс?').catch(() => 0)
  ok && (await Plugins.WindowReloadApp())
}

/**
 * 右键菜单 - 更新日志
 */
const Changelog = async () => {
  const url = `https://github.com/GUI-for-Cores/${Plugins.APP_TITLE}/releases/download/rolling-release/changelog.md`
  const { body } = await Plugins.HttpGet(url)
  await Plugins.alert(Plugin.name, body, { type: 'markdown' })
}

const checkRollingReleaseEnabled = async () => {
  const appSettings = Plugins.useAppSettingsStore()
  if (!appSettings.app.rollingRelease) {
    throw 'Пожалуйста, включите функцию [Включить плавающий выпуск] в [Настройках].'
  }
}

const checkLatestVersion = async () => {
  const GFC_URL = 'https://api.github.com/repos/GUI-for-Cores/GUI.for.Clash/releases/latest'
  const GFS_URL = 'https://api.github.com/repos/GUI-for-Cores/GUI.for.SingBox/releases/latest'
  const url = Plugins.APP_TITLE.includes('Clash') ? GFC_URL : GFS_URL
  const { body } = await Plugins.HttpGet(url, {
    Authorization: Plugins.getGitHubApiAuthorization()
  })
  const { tag_name, message } = body
  if (message) throw message
  if (tag_name !== Plugins.APP_VERSION) {
    throw 'Невозможно обновить основные версии, пожалуйста, обновите приложение через Настройки - О программе！'
  }
}
