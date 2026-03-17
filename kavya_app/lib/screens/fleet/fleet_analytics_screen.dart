import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../core/theme/kt_colors.dart';
import '../../core/theme/kt_text_styles.dart';
import '../../core/widgets/kt_stat_card.dart';
import '../../core/widgets/section_header.dart';

class FleetAnalyticsScreen extends ConsumerWidget {
  const FleetAnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Fleet Analytics',
            style: KTTextStyles.h1,
          ),
          const SizedBox(height: 4),
          const Text(
            'Performance metrics and insights',
            style: TextStyle(color: KTColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 24),

          // Key Metrics
          const SectionHeader(title: 'Performance Metrics'),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              KtStatCard(
                label: 'Avg Utilization',
                value: '78%',
                icon: Icons.tracked_changes,
                color: KTColors.success,
              ),
              KtStatCard(
                label: 'On-Time Rate',
                value: '94%',
                icon: Icons.schedule,
                color: KTColors.info,
              ),
              KtStatCard(
                label: 'Avg Fuel/km',
                value: '5.2 L',
                icon: Icons.local_gas_station,
                color: KTColors.warning,
              ),
              KtStatCard(
                label: 'Cost per Trip',
                value: '₹2,450',
                icon: Icons.attach_money,
                color: KTColors.primary,
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Vehicle Utilization Chart
          const SectionHeader(title: 'Vehicle Utilization (Last 7 Days)'),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: SizedBox(
              height: 250,
              child: BarChart(
                mainBarData(),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Revenue vs Expenses
          const SectionHeader(title: 'Revenue vs Expenses (This Month)'),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: KTColors.borderColor),
            ),
            child: SizedBox(
              height: 250,
              child: LineChart(
                mainData(),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Driver Performance
          const SectionHeader(title: 'Top Performing Drivers'),
          const SizedBox(height: 12),
          _driverPerformanceCard('Rajesh Kumar', 'MH-01-AB-1234', '45 trips', 4.8),
          const SizedBox(height: 8),
          _driverPerformanceCard('Amit Patel', 'MH-01-AB-5678', '38 trips', 4.6),
          const SizedBox(height: 8),
          _driverPerformanceCard('Vikram Singh', 'MH-01-AB-3456', '42 trips', 4.7),
          const SizedBox(height: 24),

          // Fuel Efficiency
          const SectionHeader(title: 'Fuel Efficiency by Vehicle'),
          const SizedBox(height: 12),
          _fuelEfficiencyCard('MH-01-AB-1234', '5.8 km/L', 'Good'),
          const SizedBox(height: 8),
          _fuelEfficiencyCard('MH-01-AB-5678', '6.2 km/L', 'Excellent'),
          const SizedBox(height: 8),
          _fuelEfficiencyCard('MH-01-AB-3456', '4.9 km/L', 'Average'),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  BarChartData mainBarData() {
    return BarChartData(
      barTouchData: BarTouchData(enabled: false),
      titlesData: FlTitlesData(
        show: true,
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            getTitlesWidget: (double value, TitleMeta meta) {
              const titles = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
              return SideTitleWidget(
                axisSide: meta.axisSide,
                child: Text(
                  titles[value.toInt()],
                  style: const TextStyle(fontSize: 10),
                ),
              );
            },
          ),
        ),
        leftTitles: const AxisTitles(
          sideTitles: SideTitles(showTitles: false),
        ),
      ),
      barGroups: [
        makeGroupData(0, 80),
        makeGroupData(1, 85),
        makeGroupData(2, 75),
        makeGroupData(3, 90),
        makeGroupData(4, 88),
        makeGroupData(5, 78),
        makeGroupData(6, 82),
      ],
      borderData: FlBorderData(show: false),
      gridData: const FlGridData(show: false),
    );
  }

  LineChartData mainData() {
    return LineChartData(
      gridData: const FlGridData(show: false),
      titlesData: FlTitlesData(
        bottomTitles: AxisTitles(
          sideTitles: SideTitles(
            showTitles: true,
            getTitlesWidget: (double value, TitleMeta meta) {
              const titles = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
              return SideTitleWidget(
                axisSide: meta.axisSide,
                child: Text(
                  titles[value.toInt()],
                  style: const TextStyle(fontSize: 10),
                ),
              );
            },
          ),
        ),
        leftTitles: const AxisTitles(
          sideTitles: SideTitles(showTitles: false),
        ),
      ),
      borderData: FlBorderData(show: false),
      lineBarsData: [
        LineChartBarData(
          spots: const [
            FlSpot(0, 350000),
            FlSpot(1, 380000),
            FlSpot(2, 420000),
            FlSpot(3, 450000),
          ],
          isCurved: true,
          color: KTColors.success,
          barWidth: 3,
          dotData: const FlDotData(show: true),
          belowBarData: BarAreaData(
            show: true,
            color: KTColors.success.withValues(alpha: 0.1),
          ),
        ),
        LineChartBarData(
          spots: const [
            FlSpot(0, 280000),
            FlSpot(1, 310000),
            FlSpot(2, 340000),
            FlSpot(3, 360000),
          ],
          isCurved: true,
          color: KTColors.danger,
          barWidth: 3,
          dotData: const FlDotData(show: true),
          belowBarData: BarAreaData(
            show: true,
            color: KTColors.danger.withValues(alpha: 0.1),
          ),
        ),
      ],
    );
  }

  BarChartGroupData makeGroupData(int x, double y) {
    return BarChartGroupData(
      x: x,
      barRods: [
        BarChartRodData(
          toY: y,
          color: KTColors.primary,
          width: 16,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
        ),
      ],
    );
  }

  Widget _driverPerformanceCard(
    String driverName,
    String vehicle,
    String trips,
    double rating,
  ) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: KTColors.primary.withValues(alpha: 0.1),
            child: Icon(
              Icons.person,
              color: KTColors.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  driverName,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '$vehicle • $trips',
                  style: const TextStyle(
                    fontSize: 11,
                    color: KTColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: KTColors.warning.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '${rating.toString()} ⭐',
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Colors.orange,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _fuelEfficiencyCard(String vehicle, String efficiency, String status) {
    Color statusColor = status == 'Excellent'
        ? KTColors.success
        : status == 'Good'
            ? KTColors.info
            : KTColors.warning;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: KTColors.borderColor),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                vehicle,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                efficiency,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: KTColors.primary,
                ),
              ),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: statusColor.withValues(alpha: 0.3)),
            ),
            child: Text(
              status,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: statusColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
