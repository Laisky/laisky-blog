'use strict';

import { Github, Mail, Send, Twitter, BookOpen, ExternalLink, Globe } from 'lucide-react';
import React from 'react';
import { Link, useParams } from 'react-router-dom';

export const About = () => {
  const { tab: activeTab = 'site' } = useParams();

  return (
    <div className="scrollable-content">
      <section id="about">
        <ul className="nav nav-tabs" role="tablist" id="myTab">
          <li role="presentation" className="nav-item">
            <Link
              className={`nav-link ${activeTab === 'site' ? 'active' : ''}`}
              to="/about/site/"
              role="tab"
              aria-controls="site"
              aria-selected={activeTab === 'site'}
            >
              This Site
            </Link>
          </li>
          <li className="nav-item" role="presentation">
            <Link
              className={`nav-link ${activeTab === 'me' ? 'active' : ''}`}
              to="/about/me/"
              role="tab"
              aria-controls="me"
              aria-selected={activeTab === 'me'}
            >
              Me
            </Link>
          </li>
          <li className="nav-item" role="presentation">
            <Link
              className={`nav-link ${activeTab === 'copyright' ? 'active' : ''}`}
              to="/about/copyright/"
              role="tab"
              aria-controls="copyright"
              aria-selected={activeTab === 'copyright'}
            >
              Copyright
            </Link>
          </li>
        </ul>

        <div className="tab-content" id="myTabContent">
          <div role="tabpanel" aria-labelledby="site-tab" className={`tab-pane ${activeTab === 'site' ? 'active' : ''}`} id="site">
            <article>
              <h2>About this site</h2>
              <div className="bio-section">
                <p className="bio-text">Minimalist, lightning-fast Single Page Application (SPA) built with 2025 modern web standards.</p>
                <div className="focus-areas">
                  <span className="focus-tag">React 19</span>
                  <span className="focus-tag">Vite</span>
                  <span className="focus-tag">GraphQL</span>
                  <span className="focus-tag">SCSS</span>
                  <span className="focus-tag">Bootstrap 5</span>
                  <span className="focus-tag">MongoDB</span>
                </div>
              </div>

              <div className="social-links">
                <Link target="_blank" to="https://github.com/Laisky/laisky-blog/tree/v2" rel="noreferrer" className="social-item">
                  <Github size={18} />
                  <span>Backend Repo</span>
                </Link>
                <Link target="_blank" to="https://github.com/Laisky/laisky-blog-graphql" rel="noreferrer" className="social-item">
                  <Github size={18} />
                  <span>GraphQL Repo</span>
                </Link>
                <Link target="_blank" to="https://gq_v2.laisky.com/ui/" rel="noreferrer" className="social-item">
                  <ExternalLink size={18} />
                  <span>GraphQL UI</span>
                </Link>
              </div>
            </article>
          </div>
          <div role="tabpanel" aria-labelledby="me-tab" className={`tab-pane ${activeTab === 'me' ? 'active' : ''}`} id="me">
            <article>
              <div className="intro-header">
                <span className="greeting">Hi there, I'm Laisky Cai</span>
                <span className="wave" role="img" aria-label="wave">
                  👋
                </span>
              </div>

              <div className="bio-section">
                <div className="bio-text">
                  <span className="highlight">Software Engineer since 2014</span>, expert in <span className="highlight">Golang</span>,{' '}
                  <span className="highlight">Python</span>, and <span className="highlight">ECMAScript</span>, with a deep focus on
                  Platform and Backend architecture.
                  <br />
                  <br />
                  Currently pioneering in <span className="highlight">LLM Agents</span>,{' '}
                  <span className="highlight">Trusted Execution Environments</span> (TEE), and{' '}
                  <span className="highlight">Confidential Computing</span>. Building the next generation of{' '}
                  <span className="highlight">Zero-Trust Infrastructure</span> and <span className="highlight">Blockchain Protocols</span>.
                  <br />
                  <br />
                  Passionate about reading and drawing profound lessons from history. Programming is my chosen language of creation, and I'm
                  obsessed with engineering tools that deliver elegance and utility to users worldwide.
                </div>

                <div className="focus-areas">
                  <span className="focus-tag">Golang</span>
                  <span className="focus-tag">Python</span>
                  <span className="focus-tag">LLM</span>
                  <span className="focus-tag">Backend</span>
                  <span className="focus-tag">K8s</span>
                  <span className="focus-tag">TEE</span>
                  <span className="focus-tag">PaaS</span>
                  <span className="focus-tag">SaaS</span>
                </div>
              </div>

              <div className="social-links">
                <Link target="_blank" to="https://blog.laisky.com/archives/1/" rel="noreferrer" className="social-item">
                  <BookOpen size={18} />
                  <span>Blog</span>
                </Link>
                <Link target="_blank" to="https://github.com/Laisky" rel="noreferrer" className="social-item">
                  <Github size={18} />
                  <span>GitHub</span>
                </Link>
                <Link target="_blank" to="https://t.me/laiskynotes" rel="noreferrer" className="social-item">
                  <Send size={18} />
                  <span>Channel</span>
                </Link>
                <Link target="_blank" to="https://x.com/LaiskyCai" rel="noreferrer" className="social-item">
                  <Twitter size={18} />
                  <span>Twitter/X</span>
                </Link>
                <Link target="_blank" to="https://about.me/laisky" rel="noreferrer" className="social-item">
                  <Globe size={18} />
                  <span>AboutMe</span>
                </Link>
                <a href="mailto:public@laisky.com" className="social-item">
                  <Mail size={18} />
                  <span>Email</span>
                </a>
              </div>
            </article>
          </div>
          <div
            role="tabpanel"
            aria-labelledby="copyright-tab"
            className={`tab-pane ${activeTab === 'copyright' ? 'active' : ''}`}
            id="copyright"
          >
            <article>
              <h2>Copyright</h2>
              <p>
                The content of this site is available under the "Attribution 4.0 International (CC BY 4.0)" license, meaning that the
                content can be used freely as long as the attribution is preserved.
              </p>
              <img src="https://s3.laisky.com/uploads/images/cc-by-4_0.jpg" alt="cc by 4.0" loading="lazy" />
            </article>
          </div>
        </div>
      </section>
    </div>
  );
};
