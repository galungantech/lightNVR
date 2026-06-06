/**
 * LightNVR Web Interface SystemView Component
 * Preact component for the system page
 */

import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { showStatusMessage } from './ToastContainer.jsx';
import { ContentLoader } from './LoadingIndicator.jsx';
import { useQuery, useMutation, fetchJSON } from '../../query-client.js';
import { validateSession } from '../../utils/auth-utils.js';
import { useI18n } from '../../i18n.js';
// Import system components
import { SystemControls } from './system/SystemControls.jsx';
import { SystemInfo } from './system/SystemInfo.jsx';
import { MemoryStorage } from './system/MemoryStorage.jsx';
import { StreamStorage } from './system/StreamStorage.jsx';
import { StorageHealth } from './system/StorageHealth.jsx';
import { NetworkInfo } from './system/NetworkInfo.jsx';
import { StreamsInfo } from './system/StreamsInfo.jsx';
import { WebServiceInfo } from './system/WebServiceInfo.jsx';
import { VersionsTable } from './system/VersionsTable.jsx';
import { LogsView } from './system/LogsView.jsx';
import { LogsPoller } from './system/LogsPoller.jsx';
import { ClearLogsModal } from './system/ClearLogsModal.jsx';

// Import utility functions
import { formatBytes, formatUptime, log_level_meets_minimum } from './system/SystemUtils.js';

/**
 * SystemView component
 * @returns {JSX.Element} SystemView component
 */
export function SystemView() {
  const { t } = useI18n();
  const fileInputRef = useRef(null);

  // Define all state variables first
  const [systemInfo, setSystemInfo] = useState({
    version: '', uptime: '',
    cpu: { model: '', cores: 0, usage: 0 },
    memory: { total: 0, used: 0, free: 0 },
    go2rtcMemory: { total: 0, used: 0, free: 0 },
    detectorMemory: { total: 0, used: 0, free: 0 },
    systemMemory: { total: 0, used: 0, free: 0 },
    disk: { total: 0, used: 0, free: 0 },
    systemDisk: { total: 0, used: 0, free: 0 },
    network: { interfaces: [] },
    streams: { active: 0, total: 0 },
    recordings: { count: 0, size: 0 },
    versions: { items: [] }
  });
  const [logs, setLogs] = useState([]);
  const [logLevel, setLogLevel] = useState(() => localStorage.getItem('lightnvr_system_logLevel') || 'debug');
  const logLevelRef = useRef(localStorage.getItem('lightnvr_system_logLevel') || 'debug');
  const [logCount, setLogCount] = useState(100);
  const [pollingInterval, setPollingInterval] = useState(() => {
    const saved = localStorage.getItem('lightnvr_system_pollingInterval');
    return saved ? parseInt(saved, 10) : 5000;
  });
  const [isRestarting, setIsRestarting] = useState(false);
  const [showClearLogsModal, setShowClearLogsModal] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [activeTab, setActiveTab] = useState('system');
  const [userRole, setUserRole] = useState(null);

  // Ref penampung fungsi state internal anak
  const setControlsModalRef = useRef(null);

  // Fetch user role on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const result = await validateSession();
        if (result.valid && result.role) {
          setUserRole(result.role);
        } else {
          setUserRole('');
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
        setUserRole('');
      }
    };
    fetchUserRole();
  }, []);

  const roleLoading = userRole === null;
  const canControlSystem = !roleLoading && userRole === 'admin';

  // Query Hook
  const { data: systemInfoData, isLoading } = useQuery(
    ['systemInfo'], '/api/system/info', { timeout: 15000, retries: 2, retryDelay: 1000 }
  );

  // Clear Logs Mutation
  const clearLogsMutation = useMutation({
    mutationKey: ['clearLogs'],
    mutationFn: async () => {
      return await fetchJSON('/api/system/logs/clear', { method: 'POST', timeout: 10000, retries: 1 });
    },
    onSuccess: () => {
      showStatusMessage(t('system.logsCleared'));
      setLogs([]);
    },
    onError: (error) => {
      showStatusMessage(t('system.logsClearError', { message: error.message }));
    }
  });

  // Restart system mutation
  const restartSystemMutation = useMutation({
    mutationFn: async () => {
      return await fetchJSON('/api/system/restart', { method: 'POST', timeout: 30000, retries: 0 });
    },
    onMutate: () => {
      setIsRestarting(true);
      showStatusMessage(t('system.restartingSystem'));
    },
    onSuccess: () => {
      showStatusMessage(t('system.systemRestartingWait'));
    },
    onError: (error) => {
      if (error.message && !error.message.includes('fetch') && !error.message.includes('network')) {
        showStatusMessage(t('system.restartError', { message: error.message }));
        setIsRestarting(false);
      }
    }
  });

  // Export/Backup Mutation
  const exportMigrationMutation = useMutation({
    mutationFn: async () => {
      showStatusMessage(
        'Preparing system backup file, please wait...'
      );
  
      // Trigger backend generate backup
      const response = await fetch(
        '/api/system/export',
        {
          method: 'POST'
        }
      );
  
      if (!response.ok) {
        throw new Error(
          'Failed to generate backup.'
        );
      }
  
      const result = await response.json();
      
      if (result.status !== 'success') {
        throw new Error(
          result.message ||
          'Failed to generate backup.'
        );
      }
      
      const downloadUrl =
        result.downloadUrl;
  
      // Tunggu file benar-benar siap
      let fileReady = false;
  
      for (let i = 0; i < 20; i++) {
        const headResponse = await fetch(
          `${downloadUrl}?t=${Date.now()}`,
          {
            method: 'HEAD',
            cache: 'no-store'
          }
        );
  
        const contentLength =
          headResponse.headers.get(
            'content-length'
          );
  
        if (
          headResponse.ok &&
          contentLength &&
          parseInt(contentLength) > 1024
        ) {
          fileReady = true;
          break;
        }
  
        await new Promise(resolve =>
          setTimeout(resolve, 1000)
        );
      }
  
      if (!fileReady) {
        throw new Error(
          'Backup file is not ready.'
        );
      }
  
      // Timestamp nama download
      const now = new Date();
  
      const timestamp =
        `${now.getFullYear()}-` +
        `${String(now.getMonth() + 1).padStart(2, '0')}-` +
        `${String(now.getDate()).padStart(2, '0')}_` +
        `${String(now.getHours()).padStart(2, '0')}-` +
        `${String(now.getMinutes()).padStart(2, '0')}`;
  
      // Native browser download
      const a = document.createElement('a');
  
      a.href =
        `${downloadUrl}?download=${Date.now()}`;
  
      a.download =
        `lightnvr-backup-config_${timestamp}.tar.gz`;
  
      document.body.appendChild(a);
  
      a.click();
  
      document.body.removeChild(a);
  
      return {
        status: 'success',
        message:
          'Backup file successfully downloaded!'
      };
    },
  
    onSuccess: (data) => {
      showStatusMessage(
        data.message,
        'success'
      );
    },
  
    onError: (err) => {
      showStatusMessage(
        `Export failed: ${err.message}`,
        'error'
      );
    }
  });

  // Restore Mutation
  const restoreSystemMutation = useMutation({
    mutationFn: async (file) => {
      showStatusMessage('Uploading and restoring system, please wait...');
      const response = await fetch('/api/system/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file
      });
      if (!response.ok) throw new Error('Failed to upload backup file.');
      return await response.json();
    },
    onSuccess: () => {
      showStatusMessage('Restore successful! System will be restarted...', 'success');
      
      setTimeout(() => {
        showStatusMessage(t('system.restartingSystem') || 'Initiating system restart...', 'info');
        
        if (setControlsModalRef.current) {
          setControlsModalRef.current(true);
        }
        setIsRestarting(true);

        setTimeout(() => {
          fetch('/api/system/restart', { method: 'POST' })
            .then(() => console.log('Reboot signal accepted.'))
            .catch(() => console.log('Disconnected for reboot.'));
        }, 1500);

      }, 2500);
    },
    onError: (err) => {
      showStatusMessage(`Restore error: ${err.message}`, 'error');
    }
  });

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const confirmed = window.confirm(
      "Are you sure you want to restore the system? This will overwrite existing configurations and database. This action cannot be undone."
    );
    if (confirmed) {
      restoreSystemMutation.mutate(file);
    } else {
      showStatusMessage('Restore cancelled by user.', 'info');
    }
    event.target.value = '';
  };

  const handleSetLogLevel = (newLevel) => {
    setLogLevel(newLevel);
    logLevelRef.current = newLevel;
    localStorage.setItem('lightnvr_system_logLevel', newLevel);
  };

  const handleLogsReceived = useCallback((newLogs) => {
    const currentLogLevel = logLevelRef.current;
    const filteredLogs = newLogs.filter(log => log_level_meets_minimum(log.level, currentLogLevel));
    setLogs(filteredLogs);
  }, []);

  useEffect(() => { if (systemInfoData) setHasData(true); }, [systemInfoData]);
  useEffect(() => { if (systemInfoData) setSystemInfo(systemInfoData); }, [systemInfoData]);

  const handleRestartConfirm = () => {
    restartSystemMutation.mutate();
  };

  return (
    <section id="system-page" className="page">
      <SystemControls
        onRestartConfirm={handleRestartConfirm}
        onExportConfirm={() => exportMigrationMutation.mutate()}
        onRestoreConfirm={() => fileInputRef.current?.click()}
        isRestarting={isRestarting}
        canControlSystem={canControlSystem}
        onComponentLoad={(setModalState) => { setControlsModalRef.current = setModalState; }} // Ikat fungsi state di sini
      />

      <input ref={fileInputRef} type="file" accept=".tar.gz" onChange={handleFileChange} style={{ display: 'none' }} />

      <ContentLoader
        isLoading={isLoading} hasData={hasData}
        loadingMessage={t('system.loadingSystemInformation')} emptyMessage={t('system.systemInformationUnavailable')}
      >
        <div className="mb-4 border-b border-border" role="tablist">
          <div className="flex gap-2">
            <button type="button" className={`rounded-t-lg px-4 py-2 text-sm font-medium ${activeTab === 'system' ? 'bg-card border border-border border-b-0 -mb-px' : 'text-muted-foreground'}`} onClick={() => setActiveTab('system')}>
              {t('system.system')}
            </button>
            <button type="button" className={`rounded-t-lg px-4 py-2 text-sm font-medium ${activeTab === 'versions' ? 'bg-card border border-border border-b-0 -mb-px' : 'text-muted-foreground'}`} onClick={() => setActiveTab('versions')}>
              {t('system.versions')}
            </button>
          </div>
        </div>

        {activeTab === 'system' ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <SystemInfo systemInfo={systemInfo} formatUptime={formatUptime} />
              <MemoryStorage systemInfo={systemInfo} formatBytes={formatBytes} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <StreamsInfo systemInfo={systemInfo} formatBytes={formatBytes} />
              <StorageHealth formatBytes={formatBytes} />
            </div>
            <div className="mb-4">
              <StreamStorage systemInfo={systemInfo} formatBytes={formatBytes} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <NetworkInfo systemInfo={systemInfo} />
              <WebServiceInfo systemInfo={systemInfo} />
            </div>
            <LogsView logs={logs} logLevel={logLevel} logCount={logCount} pollingInterval={pollingInterval} setLogLevel={handleSetLogLevel} setLogCount={setLogCount} setPollingInterval={setPollingInterval} loadLogs={() => window.dispatchEvent(new CustomEvent('refresh-logs'))} clearLogs={() => setShowClearLogsModal(true)} />
            <LogsPoller logLevel={logLevel} logCount={logCount} pollingInterval={pollingInterval} onLogsReceived={handleLogsReceived} />
          </div>
        ) : (
          <VersionsTable versions={systemInfo.versions} />
        )}
      </ContentLoader>

      <ClearLogsModal isOpen={showClearLogsModal} onClose={() => setShowClearLogsModal(false)} onConfirm={() => clearLogsMutation.mutate()} />
    </section>
  );
}
