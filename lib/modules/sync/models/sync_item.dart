import 'package:hive/hive.dart';

part 'sync_item.g.dart';

@HiveType(typeId: 3)
enum SyncOperation {
  @HiveField(0)
  create,
  @HiveField(1)
  update,
  @HiveField(2)
  delete
}

@HiveType(typeId: 4)
class SyncItem extends HiveObject {
  @HiveField(0)
  final String entityType; // 'project', 'evidence'

  @HiveField(1)
  final String entityId;

  @HiveField(2)
  final SyncOperation operation;

  @HiveField(3)
  final DateTime timestamp;

  SyncItem({
    required this.entityType,
    required this.entityId,
    required this.operation,
    required this.timestamp,
  });
}
