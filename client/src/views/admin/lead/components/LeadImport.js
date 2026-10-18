import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RecordImportDialog from 'components/table/RecordImportDialog';

export default function ImportPage() {
  const location = useLocation(), navigate = useNavigate();
  return <RecordImportDialog moduleName='Leads' isOpen initialFile={location.state?.fileData?.[0]} onClose={() => navigate('/lead')} />;
}
