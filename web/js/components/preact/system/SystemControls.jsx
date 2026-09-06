/**
 * SystemControls Component
 * Provides system restart control with a styled modal
 */

import { useState, useEffect } from 'preact/hooks';
import { RestartModal } from './RestartModal.jsx';
import { useI18n } from '../../../i18n.js';

/**
 * SystemControls component
 * @param {Object} props Component props
 * @param {Function} props.onRestartConfirm Function to call when restart is confirmed
 * @param {Function} props.onExportConfirm Function to call when backup/export is clicked
 * @param {Function} props.onRestoreConfirm Function to call when restore is clicked
 * @param {boolean} props.isRestarting Whether lightNVR is currently restarting
 * @param {boolean} props.canControlSystem Whether the user has permission to control the system
 * @param {Function} props.onComponentLoad Jembatan agar parent bisa mengontrol state modal
 * @returns {JSX.Element} SystemControls component
 */
export function SystemControls({ 
  onRestartConfirm, 
  onExportConfirm, 
  onRestoreConfirm, 
  isRestarting, 
  canControlSystem = true,
  onComponentLoad
}) {
  const [showRestartModal, setShowRestartModal] = useState(false);
  const { t } = useI18n();

  // Kirim fungsi setShowRestartModal ke SystemView saat komponen dimuat
  useEffect(() => {
    if (onComponentLoad) {
      onComponentLoad(setShowRestartModal);
    }
  }, [onComponentLoad]);

  const handleRestartClick = () => {
    setShowRestartModal(true);
  };

  const handleRestartConfirm = () => {
    if (onRestartConfirm) {
      onRestartConfirm();
    }
  };

  const handleCloseModal = () => {
    if (!isRestarting) {
      setShowRestartModal(false);
    }
  };

  return (
    <>
      <div className="page-header flex justify-between items-center mb-4 p-4 bg-card text-card-foreground rounded-lg shadow">
        <h2 className="text-xl font-bold">{t('system.system')}</h2>
        <div className="controls flex items-center space-x-2">
          {canControlSystem && (
            <>
              {/* BACKUP BUTTON */}
              <button
                type="button"
                className="btn-warning focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: '#2563eb',
                  '--tw-ring-color': '#2563eb' 
                }}
                onClick={onExportConfirm}
                disabled={isRestarting}
              >
                Backup Config
              </button>

              {/* UPLOAD & RESTORE BUTTON */}
              <button
                type="button"
                className="btn-warning focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  backgroundColor: '#d97706',
                  '--tw-ring-color': '#d97706' 
                }}
                onClick={onRestoreConfirm}
                disabled={isRestarting}
              >
                Upload & Restore
              </button>

              {/* RESTART BUTTON */}
              <button
                id="restart-btn"
                className="btn-warning focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ '--tw-ring-color': 'hsl(var(--warning))' }}
                onClick={handleRestartClick}
                disabled={isRestarting}
              >
                {t('system.restartLightNvr')}
              </button>
            </>
          )}
        </div>
      </div>

      <RestartModal
        isOpen={showRestartModal}
        onClose={handleCloseModal}
        onConfirm={handleRestartConfirm}
        isRestarting={isRestarting}
      />
    </>
  );
}
