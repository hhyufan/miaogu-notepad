import React from 'react';
import { useTranslation } from 'react-i18next';

const LoadingComponent = () => {
  const { t } = useTranslation();
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '16px',
      color: '#666'
    }}>
      {t('common.loading')}
    </div>
  );
};

export default LoadingComponent;