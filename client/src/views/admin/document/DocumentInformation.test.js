/* eslint-disable testing-library/no-node-access, testing-library/no-unnecessary-act */
import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import DocumentInformation from './DocumentInformation';

test('document cards show category, storage, owner, property and every saved custom value outside the upload form', () => {
  const container = document.createElement('div');
  act(() => { ReactDOM.render(<DocumentInformation category="Properties" folderName="Contracts" file={{
    entityType: 'Property', relatedRecords: [
      { entityType: 'Property', entityId: 'property', label: 'Garden Villa' },
      { entityType: 'Contact', entityId: 'owner', label: 'Villa Owner' },
    ], customFields: { reference: 'Contract A', pages: 0, signed: false },
  }} definition={{ fields: [{ name: 'reference', kind: 'CUSTOM_FIELD', label: { en: 'Reference' } }] }} />, container); });
  for (const value of ['2. Information and category', 'Section / category', 'Properties', 'Storage location', 'Contracts',
    'Property Owner', 'Villa Owner', 'Garden Villa', 'Reference', 'Contract A', '0', 'false']) expect(container.textContent).toContain(value);
  expect(container.querySelector('input')).toBeNull();
  act(() => { ReactDOM.unmountComponentAtNode(container); });
});
