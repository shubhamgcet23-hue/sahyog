import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Field, Modal } from './ui';
import { api, errMsg } from '../services/api';
import { REPORT_REASONS } from '../utils/constants';

/** Report a user, listing, review or emergency request. Administrators review reports in the moderation queue. */
export default function ReportDialog({ open, onClose, targetType, targetId, label = 'content' }) {
  const [reason, setReason] = useState('SPAM');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setReason('SPAM'); setDescription(''); } }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/reports', { targetType, targetId, reason, description: description.trim() || undefined });
      toast.success('Thanks — an administrator will review this report.');
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Report this ${label}`} size="max-w-md"
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><Button loading={busy} onClick={submit}>Send report</Button></>}>
      <div className="space-y-4">
        <Field label="Reason">
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {Object.entries(REPORT_REASONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Details (optional)" hint="Tell us what happened. Don’t include passwords or financial details.">
          <textarea className="input min-h-24" maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
