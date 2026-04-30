import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../context/AuthContext';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ ...styles.statCard, borderColor: accent ? `${accent}33` : 'var(--border)' }}>
      <div style={styles.statIcon}>{icon}</div>
      <div style={{ ...styles.statValue, color: accent || 'var(--text-primary)' }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
      {sub && <div style={styles.statSub}>{sub}</div>}
      <div style={{ ...styles.statGlow, background: accent || 'var(--accent)' }} />
    </div>
  );
}

const STATUS_COLORS = {
  pending: '#ffab00', confirmed: '#00e676', processing: '#00d4ff',
  in_transit: '#00d4ff', out_for_delivery: '#ff6b35', delivered: '#00e676',
  cancelled: '#ff3d57', returned: '#7a9cc4',
};

export default function DashboardHome() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.loading}>Loading dashboard…</div>;
  if (!data) return <div style={styles.loading}>Failed to load data</div>;

  const { stats, statusBreakdown, monthlyTrend, recentOrders } = data;

  const chartData = (monthlyTrend || []).map(m => ({
    name: MONTH_NAMES[m._id.month - 1],
    orders: m.count,
    revenue: m.revenue || 0,
  }));

  const pieData = Object.entries(statusBreakdown || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: k, value: v }));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">COMMAND CENTER</div>
          <div className="page-subtitle">Real-time logistics overview</div>
        </div>
        <div style={styles.refreshBtn} onClick={() => window.location.reload()}>↻ Refresh</div>
      </div>

      {/* Stat cards */}
      <div className="grid-4 mb-24">
        <StatCard label="Total Orders" value={stats.totalOrders} icon="◈" accent="#00d4ff"
          sub={`+${stats.ordersThisMonth} this month`} />
        <StatCard label="In Transit" value={stats.inTransitOrders} icon="◎" accent="#ff6b35"
          sub="Active shipments" />
        <StatCard label="Delivered" value={stats.deliveredOrders} icon="◉" accent="#00e676"
          sub="All time" />
        <StatCard label="Pending" value={stats.pendingOrders} icon="⬡" accent="#ffab00"
          sub="Awaiting processing" />
      </div>

      {/* Charts row */}
      <div style={styles.chartsRow}>
        {/* Area chart */}
        <div className="card" style={{ flex: 2 }}>
          <div style={styles.chartHeader}>
            <span style={styles.chartTitle}>ORDER VOLUME</span>
            <span style={styles.chartSub}>Last 6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,51,84,0.8)" />
              <XAxis dataKey="name" tick={{ fill: '#4a6a8a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#4a6a8a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#111d35', border: '1px solid #1e3354', borderRadius: '8px', color: '#e8f0fe' }}
                labelStyle={{ color: '#00d4ff' }}
              />
              <Area type="monotone" dataKey="orders" stroke="#00d4ff" strokeWidth={2} fill="url(#grad1)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card" style={{ flex: 1, minWidth: '240px' }}>
          <div style={styles.chartHeader}>
            <span style={styles.chartTitle}>STATUS BREAKDOWN</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.name] || '#4a6a8a'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#111d35', border: '1px solid #1e3354', borderRadius: '8px', color: '#e8f0fe' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={styles.legend}>
            {pieData.map((entry, i) => (
              <div key={i} style={styles.legendItem}>
                <div style={{ ...styles.legendDot, background: STATUS_COLORS[entry.name] || '#4a6a8a' }} />
                <span style={styles.legendLabel}>{entry.name.replace('_', ' ')}</span>
                <span style={styles.legendValue}>{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="card mt-24">
        <div style={styles.chartHeader}>
          <span style={styles.chartTitle}>RECENT ORDERS</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Client</th>
                <th>Items</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {(recentOrders || []).map(order => (
                <tr key={order._id}>
                  <td><span className="mono text-accent">{order.orderNumber}</span></td>
                  <td>{order.client?.name || '—'}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{order.client?.company}</div></td>
                  <td>{order.items?.length || 0} item(s)</td>
                  <td><span className={`badge badge-${order.status}`}>{order.status?.replace('_', ' ')}</span></td>
                  <td><span className={`badge badge-${order.priority}`}>{order.priority}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {!recentOrders?.length && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px' }}>No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)' },
  statCard: {
    background: 'var(--bg-card)',
    border: '1px solid',
    borderRadius: '12px',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
    transition: 'border-color 0.2s',
  },
  statIcon: { fontSize: '22px', marginBottom: '12px', opacity: 0.7 },
  statValue: { fontFamily: 'var(--font-display)', fontSize: '36px', fontWeight: '700', lineHeight: 1 },
  statLabel: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginTop: '6px' },
  statSub: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' },
  statGlow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', opacity: 0.6 },
  chartsRow: { display: 'flex', gap: '20px', flexWrap: 'wrap' },
  chartHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  chartTitle: { fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: '700', letterSpacing: '2px', color: 'var(--text-secondary)' },
  chartSub: { fontSize: '11px', color: 'var(--text-muted)' },
  legend: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  legendDot: { width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0 },
  legendLabel: { flex: 1, fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'capitalize' },
  legendValue: { fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 },
  refreshBtn: { padding: '8px 16px', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-mono)' },
};
