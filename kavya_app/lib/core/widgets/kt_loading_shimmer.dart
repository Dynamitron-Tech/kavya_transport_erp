import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

enum ShimmerType { list, card, stat }

class KTLoadingShimmer extends StatelessWidget {
  final ShimmerType type;
  const KTLoadingShimmer({super.key, this.type = ShimmerType.list});

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey[300]!,
      highlightColor: Colors.grey[100]!,
      child: _buildLayout(),
    );
  }

  Widget _buildLayout() {
    switch (type) {
      case ShimmerType.stat:
        return Container(height: 100, width: double.infinity, color: Colors.white);
      case ShimmerType.card:
        return Container(height: 200, width: double.infinity, margin: const EdgeInsets.only(bottom: 16), color: Colors.white);
      case ShimmerType.list:
        return ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 5,
          itemBuilder: (_, __) => Padding(
            padding: const EdgeInsets.only(bottom: 8.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(width: 48, height: 48, color: Colors.white),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(width: double.infinity, height: 8, color: Colors.white),
                      const SizedBox(height: 8),
                      Container(width: 40, height: 8, color: Colors.white),
                    ],
                  ),
                )
              ],
            ),
          ),
        );
    }
  }
}