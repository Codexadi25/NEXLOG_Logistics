import React from 'react';
import './Home.css';

export default function Home() {
  return (
    <div className="saas-container">
      {/* Background Orbs & Effects */}
      <div className="saas-glow saas-glow-primary"></div>
      <div className="saas-glow saas-glow-secondary"></div>
      <div className="saas-grid"></div>

      {/* Top Navbar */}
      <nav style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', padding: '24px 0', alignItems: 'center', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg viewBox="0 0 40 40" width="32" height="32">
            <polygon points="20,2 38,12 38,28 20,38 2,28 2,12" fill="none" stroke="#00d4ff" strokeWidth="2"/>
            <circle cx="20" cy="20" r="5" fill="#00d4ff"/>
          </svg>
          <span style={{ fontFamily: 'Outfit, sans-serif', fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: 2 }}>NEXLOG</span>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <a href="/track" style={{ color: '#94a3b8', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Track Shipment</a>
          <a href="/login" className="saas-btn saas-btn-outline" style={{ padding: '8px 20px', fontSize: 14, textDecoration: 'none' }}>Sign In</a>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="saas-hero" style={{ marginTop: 60 }}>
        <div className="saas-badge">A Product by Aditya Tech & Devoops</div>
        <h1 className="saas-title">
          The Future of <span className="saas-text-gradient">B2B Logistics</span> & Q-Commerce
        </h1>
        <p className="saas-subtitle">
          NEXLOG is the ultimate end-to-end fleet management and dispatch SaaS. Gain unparalleled visibility, automate your dispatch, and empower your support teams with our state-of-the-art logistics engine.
        </p>
        <div className="saas-cta-group">
          <a href="/login" className="saas-btn saas-btn-primary" style={{ textDecoration: 'none' }}>Start Free Trial</a>
          <a href="/login" className="saas-btn saas-btn-outline" style={{ textDecoration: 'none' }}>Book a Demo</a>
        </div>
      </header>

      {/* Features Section */}
      <section className="saas-features">
        <div className="saas-section-header">
          <h2>Why Choose NEXLOG?</h2>
          <p>Engineered for high-volume, strictly SLA-bound delivery networks.</p>
        </div>
        
        <div className="saas-features-grid">
          <div className="saas-feature-card">
            <div className="saas-feature-icon">◉</div>
            <h3>Real-Time WebSocket Tracking</h3>
            <p>Monitor your entire fleet with sub-second latency. Instantly react to route deviations and delivery statuses.</p>
          </div>
          <div className="saas-feature-card">
            <div className="saas-feature-icon">🛟</div>
            <h3>Support Lifeline Dashboard</h3>
            <p>Equip your agents with 4-pane context views, one-click copy, and crystal timelines to resolve tickets in seconds.</p>
          </div>
          <div className="saas-feature-card">
            <div className="saas-feature-icon">⛟</div>
            <h3>Intelligent Dispatch Engine</h3>
            <p>Automate driver assignments based on geographic proximity, vehicle type, and current load capacity.</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="saas-pricing">
        <div className="saas-section-header">
          <h2>Simple, Transparent Pricing</h2>
          <p>Scale your operations without worrying about unpredictable costs.</p>
        </div>

        <div className="saas-pricing-grid">
          {/* Starter Tier */}
          <div className="saas-pricing-card">
            <div className="saas-tier">Starter</div>
            <div className="saas-price">₹4,999<span>/mo</span></div>
            <p className="saas-pricing-desc">Perfect for growing local delivery hubs and small merchants.</p>
            <ul className="saas-feature-list">
              <li>✓ Up to 1,000 Orders/mo</li>
              <li>✓ 10 Delivery Partners</li>
              <li>✓ Basic Dashboard Access</li>
              <li>✓ Standard Email Support</li>
            </ul>
            <button className="saas-btn saas-btn-outline saas-btn-full">Get Started</button>
          </div>

          {/* Professional Tier */}
          <div className="saas-pricing-card saas-pricing-card-featured">
            <div className="saas-featured-badge">Most Popular</div>
            <div className="saas-tier">Professional</div>
            <div className="saas-price">₹14,999<span>/mo</span></div>
            <p className="saas-pricing-desc">For mid-sized regional logistics networks demanding high visibility.</p>
            <ul className="saas-feature-list">
              <li>✓ Up to 10,000 Orders/mo</li>
              <li>✓ 100 Delivery Partners</li>
              <li>✓ Support Lifeline Module</li>
              <li>✓ Live WebSocket Tracking</li>
              <li>✓ Priority Chat Support</li>
            </ul>
            <button className="saas-btn saas-btn-primary saas-btn-full">Start Free Trial</button>
          </div>

          {/* Enterprise Tier */}
          <div className="saas-pricing-card">
            <div className="saas-tier">Enterprise</div>
            <div className="saas-price">Custom</div>
            <p className="saas-pricing-desc">Uncapped operations for large-scale quick commerce platforms.</p>
            <ul className="saas-feature-list">
              <li>✓ Unlimited Orders</li>
              <li>✓ Unlimited Partners</li>
              <li>✓ Automated Algorithmic Dispatch</li>
              <li>✓ Custom AI KYC Extraction</li>
              <li>✓ Dedicated Account Manager</li>
            </ul>
            <button className="saas-btn saas-btn-outline saas-btn-full">Contact Sales</button>
          </div>
        </div>
      </section>

      {/* Footer / Contact */}
      <footer className="saas-footer">
        <div className="saas-footer-content">
          <h3>Ready to revolutionize your logistics?</h3>
          <p>Join the next generation of supply chain technology crafted by Aditya Tech & Devoops.</p>
          <div className="saas-footer-brand">© 2026 Aditya Tech & Devoops. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
