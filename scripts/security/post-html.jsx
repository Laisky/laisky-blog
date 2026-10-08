import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Post } from '../../src/jsx/pages/post.jsx';

window.MathJax = { Hub: { Queue: () => {} } };
const history = new URLSearchParams(window.location.search).get('mode') === 'history';
createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/p/local-test/']}>
    <Routes>
      <Route path="/p/:name/" element={<Post isHistory={history ? 'true' : 'false'} />} />
    </Routes>
  </MemoryRouter>
);
