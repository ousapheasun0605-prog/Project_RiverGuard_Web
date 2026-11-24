import {
  Activity,
  CheckCircle2,
  Gauge,
  Route,
  Waves,
} from "lucide-react";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

const wasteColors = ["#2F76A8", "#75B9D3", "#39866B"];

const wasteData = [];
const missionDistanceData = [];
const cleanupTrendData = [];

function SummaryCard({ icon: Icon, label, value, unit, description }) {
  return (
    <article className="analytics-stat-card">
      <div className="analytics-stat-top">
        <span>{label}</span>
        <div className="analytics-stat-icon">
          <Icon size={19} />
        </div>
      </div>

      <div className="analytics-stat-value">
        {value}
        {unit && <span>{unit}</span>}
      </div>

      <p>{description}</p>
    </article>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="analytics-empty-chart">
      <div className="analytics-empty-icon">
        <Activity size={24} />
      </div>
      <strong>No data available yet</strong>
      <span>{message}</span>
    </div>
  );
}

function ChartPanel({ title, description, children, className = "" }) {
  return (
    <article className={`panel analytics-chart-panel ${className}`}>
      <div className="analytics-chart-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {children}
    </article>
  );
}

export default function Analytics() {
  const hasWasteData = wasteData.length > 0;
  const hasMissionData = missionDistanceData.length > 0;
  const hasTrendData = cleanupTrendData.length > 0;

  return (
    <div className="analytics-page">
      <div className="page-heading">
        <div>
          <h1>Analytics</h1>
          <p>Review cleanup performance and mission statistics.</p>
        </div>
      </div>

      {/* Performance overview */}
      <section className="analytics-overview">
        <SummaryCard
          icon={Waves}
          label="Debris removed"
          value="—"
          unit="kg"
          description="Total collected waste"
        />

        <SummaryCard
          icon={CheckCircle2}
          label="Completed missions"
          value="—"
          description="Successfully completed missions"
        />

        <SummaryCard
          icon={Route}
          label="Waterway covered"
          value="—"
          unit="km"
          description="Total distance covered"
        />

        <SummaryCard
          icon={Gauge}
          label="Collection efficiency"
          value="—"
          unit="kg/hr"
          description="Average collection rate"
        />
      </section>

      {/* Waste distribution and mission performance */}
      <section className="analytics-chart-grid">
        <ChartPanel
          title="Waste distribution"
          description="Collected waste by category"
          className="analytics-waste-panel"
        >
          {hasWasteData ? (
            <div className="analytics-donut-layout">
              <div className="analytics-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={wasteData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="62%"
                      outerRadius="88%"
                      paddingAngle={3}
                    >
                      {wasteData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={wasteColors[index % wasteColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="analytics-legend">
                {wasteData.map((item, index) => (
                  <div className="analytics-legend-item" key={item.name}>
                    <span
                      className="analytics-legend-dot"
                      style={{
                        backgroundColor:
                          wasteColors[index % wasteColors.length],
                      }}
                    />
                    <span>{item.name}</span>
                    <strong>{item.value} kg</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyChart message="Waste category statistics will appear when collection records are available." />
          )}
        </ChartPanel>

        <ChartPanel
          title="Mission performance"
          description="Distance covered per mission"
          className="analytics-distance-panel"
        >
          {hasMissionData ? (
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={missionDistanceData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E3EDF4"
                  />
                  <XAxis
                    dataKey="mission"
                    tick={{ fill: "#64849B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64849B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    unit=" km"
                  />
                  <Tooltip />
                  <Bar
                    dataKey="distance"
                    name="Distance"
                    fill="#2F76A8"
                    radius={[5, 5, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Distance statistics will appear after missions have recorded GPS routes." />
          )}
        </ChartPanel>
      </section>

      {/* Cleanup trends */}
      <section className="analytics-trend-section">
        <ChartPanel
          title="Cleanup trends"
          description="Waste collection over time"
          className="analytics-trend-panel"
        >
          {hasTrendData ? (
            <div className="analytics-chart analytics-trend-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={cleanupTrendData}
                  margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E3EDF4"
                  />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "#64849B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#64849B", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    unit=" kg"
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="waste"
                    name="Waste collected"
                    stroke="#2F76A8"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#2F76A8" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Collection trends will appear once mission data has been recorded over time." />
          )}
        </ChartPanel>
      </section>
    </div>
  );
}