import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../config/app_theme.dart';

class LoadingSkeletonWidget extends StatelessWidget {
  final int itemCount;
  final LoadingVariant variant;

  const LoadingSkeletonWidget({
    super.key,
    this.itemCount = 4,
    this.variant = LoadingVariant.card,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: switch (variant) {
        LoadingVariant.card => _buildCards(),
        LoadingVariant.list => _buildList(),
        LoadingVariant.form => _buildForm(),
      },
    );
  }

  Widget _buildCards() => ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: itemCount,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (_, __) => Container(
          height: 100,
          decoration: BoxDecoration(
            color: AppTheme.card,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      );

  Widget _buildList() => ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: itemCount,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (_, __) => Container(
          height: 60,
          decoration: BoxDecoration(
            color: AppTheme.card,
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );

  Widget _buildForm() => Column(
        children: List.generate(
          itemCount,
          (_) => Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                    width: 80,
                    height: 12,
                    decoration: BoxDecoration(
                      color: AppTheme.card,
                      borderRadius: BorderRadius.circular(4),
                    )),
                const SizedBox(height: 8),
                Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppTheme.card,
                      borderRadius: BorderRadius.circular(10),
                    )),
              ],
            ),
          ),
        ),
      );
}

enum LoadingVariant { card, list, form }
