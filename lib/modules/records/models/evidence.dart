import 'package:hive/hive.dart';
import 'custom_field.dart';

part 'evidence.g.dart';

@HiveType(typeId: 2)
class Evidence extends HiveObject {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String projectId;

  @HiveField(2)
  final String photoPath;

  @HiveField(3)
  final String fecha;

  @HiveField(4)
  final String hora;

  @HiveField(5)
  final double latitude;

  @HiveField(6)
  final double longitude;

  @HiveField(7)
  final String direccion;

  @HiveField(8)
  final Map<String, String> baseFields; // {posteId, tecnico, etc}

  @HiveField(9)
  final List<CustomField> customFields;

  @HiveField(10)
  final bool sharedWhatsApp;

  @HiveField(11)
  final DateTime createdAt;

  @HiveField(12)
  final bool locked;

  Evidence({
    required this.id,
    required this.projectId,
    required this.photoPath,
    required this.fecha,
    required this.hora,
    required this.latitude,
    required this.longitude,
    required this.direccion,
    required this.baseFields,
    required this.customFields,
    this.sharedWhatsApp = false,
    required this.createdAt,
    this.locked = true,
  });
}
