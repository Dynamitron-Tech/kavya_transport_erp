import 'package:flutter/material.dart';
import '../theme/kt_colors.dart';
import '../theme/kt_text_styles.dart';

/// Stat card for displaying KPI metrics
class KTStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? accentColor;
  final String? trend; // e.g., "+12.5%"
  final bool trendUp;
  final VoidCallback? onTap;

  const KTStatCard({
    Key? key,
    required this.label,
    required this.value,
    required this.icon,
    this.accentColor = KTColors.amber500,
    this.trend,
    this.trendUp = true,
    this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon circle
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: accentColor?.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Center(
                  child: Icon(
                    icon,
                    color: accentColor,
                    size: 24,
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Value (large number in monospace, amber)
              Text(
                value,
                style: KTTextStyles.kpiNumber.copyWith(
                  color: accentColor ?? KTColors.amber500,
                ),
              ),
              const SizedBox(height: 8),

              // Label
              Text(
                label,
                style: KTTextStyles.bodySmall.copyWith(
                  color: KTColors.gray500,
                ),
              ),

              // Trend indicator
              if (trend != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(
                      trendUp
                          ? Icons.trending_up_rounded
                          : Icons.trending_down_rounded,
                      color: trendUp ? KTColors.success : KTColors.danger,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      trend!,
                      style: KTTextStyles.caption.copyWith(
                        color: trendUp ? KTColors.success : KTColors.danger,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Status badge/pill for inline status display
class KTStatusBadge extends StatelessWidget {
  final String label;
  final KTStatusType status;
  final VoidCallback? onTap;

  const KTStatusBadge({
    Key? key,
    required this.label,
    required this.status,
    this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final (bgColor, textColor) = _getColors();

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label.toUpperCase(),
          style: KTTextStyles.caption.copyWith(
            color: textColor,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }

  (Color, Color) _getColors() {
    return switch (status) {
      KTStatusType.draft => (KTColors.gray100, KTColors.gray600),
      KTStatusType.pendingApproval => (KTColors.infoBg, KTColors.info),
      KTStatusType.approved => (Color(0xFFEDE9FE), Color(0xFF6D28D9)),
      KTStatusType.inProgress => (KTColors.warningBg, KTColors.warning),
      KTStatusType.completed => (KTColors.successBg, KTColors.success),
      KTStatusType.cancelled => (KTColors.dangerBg, KTColors.danger),
      KTStatusType.pending => (KTColors.warningBg, KTColors.warning),
      KTStatusType.failed => (KTColors.dangerBg, KTColors.danger),
    };
  }
}

enum KTStatusType {
  draft,
  pendingApproval,
  approved,
  inProgress,
  completed,
  cancelled,
  pending,
  failed,
}

/// Error/Alert message card
class KTAlertCard extends StatelessWidget {
  final String message;
  final KTAlertType type;
  final IconData? icon;
  final VoidCallback? onDismiss;
  final Widget? action;

  const KTAlertCard({
    Key? key,
    required this.message,
    required this.type,
    this.icon,
    this.onDismiss,
    this.action,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final (bgColor, textColor, defaultIcon) = _getColors();

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: textColor.withOpacity(0.5),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            icon ?? defaultIcon,
            color: textColor,
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: KTTextStyles.bodySmall.copyWith(
                color: textColor,
              ),
            ),
          ),
          if (action != null) ...[
            const SizedBox(width: 8),
            action!,
          ] else if (onDismiss != null) ...[
            const SizedBox(width: 8),
            GestureDetector(
              onTap: onDismiss,
              child: Icon(
                Icons.close,
                color: textColor,
                size: 18,
              ),
            ),
          ],
        ],
      ),
    );
  }

  (Color, Color, IconData) _getColors() {
    return switch (type) {
      KTAlertType.success => (
          KTColors.successBg,
          KTColors.success,
          Icons.check_circle_outline,
        ),
      KTAlertType.warning => (
          KTColors.warningBg,
          KTColors.warning,
          Icons.warning_outlined,
        ),
      KTAlertType.error => (
          KTColors.dangerBg,
          KTColors.danger,
          Icons.error_outline,
        ),
      KTAlertType.info => (
          KTColors.infoBg,
          KTColors.info,
          Icons.info_outlined,
        ),
    };
  }
}

enum KTAlertType { success, warning, error, info }

/// Enhanced info card/section
class KTInfoCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color? backgroundColor;
  final Color? borderColor;
  final VoidCallback? onTap;

  const KTInfoCard({
    Key? key,
    required this.title,
    required this.subtitle,
    required this.icon,
    this.backgroundColor,
    this.borderColor,
    this.onTap,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: backgroundColor ?? KTColors.navy100,
          border: Border.all(
            color: borderColor ?? KTColors.navy100.withOpacity(0.5),
            width: 1,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, color: KTColors.navy800, size: 32),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: KTTextStyles.label.copyWith(
                      color: KTColors.navy800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style: KTTextStyles.caption.copyWith(
                      color: KTColors.gray500,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_forward_rounded,
              color: KTColors.gray400,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}

/// Empty state placeholder
class KTEmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  const KTEmptyState({
    Key? key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            size: 64,
            color: KTColors.gray300,
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: KTTextStyles.h3.copyWith(
              color: KTColors.gray700,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: KTTextStyles.bodySmall.copyWith(
              color: KTColors.gray500,
            ),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[
            const SizedBox(height: 24),
            action!,
          ],
        ],
      ),
    );
  }
}

/// Loading state shimmer
class KTShimmerPlaceholder extends StatefulWidget {
  final double width;
  final double height;
  final BorderRadius? borderRadius;

  const KTShimmerPlaceholder({
    Key? key,
    this.width = double.infinity,
    required this.height,
    this.borderRadius,
  }) : super(key: key);

  @override
  State<KTShimmerPlaceholder> createState() => _KTShimmerPlaceholderState();
}

class _KTShimmerPlaceholderState extends State<KTShimmerPlaceholder>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: widget.borderRadius ?? BorderRadius.circular(8),
            gradient: LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [
                KTColors.navy800,
                KTColors.navy700,
                KTColors.navy800,
              ],
              stops: [
                (_controller.value - 0.3).clamp(0.0, 1.0),
                _controller.value,
                (_controller.value + 0.3).clamp(0.0, 1.0),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Role badge with color coding
class KTRoleBadge extends StatelessWidget {
  final String role;
  final bool compact;

  const KTRoleBadge({
    Key? key,
    required this.role,
    this.compact = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final color = KTColors.getRoleColor(role);
    final bgColor = KTColors.getRoleBackgroundColor(role);

    if (compact) {
      return Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(
          child: Text(
            role.substring(0, 1).toUpperCase(),
            style: KTTextStyles.buttonSmall.copyWith(
              color: color,
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        role.replaceAll('_', ' ').toUpperCase(),
        style: KTTextStyles.caption.copyWith(
          color: color,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// Data table row with hover effect
class KTTableRow extends StatelessWidget {
  final List<String> cells;
  final VoidCallback? onTap;
  final Color? hoverColor;

  const KTTableRow({
    Key? key,
    required this.cells,
    this.onTap,
    this.hoverColor = KTColors.amber50,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Material(
      child: InkWell(
        onTap: onTap,
        hoverColor: hoverColor,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: List.generate(
              cells.length,
              (index) => Expanded(
                child: Text(
                  cells[index],
                  style: KTTextStyles.tableCell,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
