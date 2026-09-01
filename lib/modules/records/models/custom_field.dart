import 'package:hive/hive.dart';

part 'custom_field.g.dart';

@HiveType(typeId: 1)
class CustomField {
  @HiveField(0)
  final String name;

  @HiveField(1)
  final String value;

  @HiveField(2)
  final bool showInPhoto;

  CustomField({
    required this.name,
    required this.value,
    required this.showInPhoto,
  });
}
