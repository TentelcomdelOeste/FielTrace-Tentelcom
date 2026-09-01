import 'package:hive_flutter/hive_flutter.dart';
import '../modules/projects/models/project.dart';
import '../modules/records/models/evidence.dart';
import '../modules/sync/models/sync_item.dart';

class HiveService {
  static const String projectsBoxName = 'projects';
  static const String evidencesBoxName = 'evidences';
  static const String syncBoxName = 'sync_queue';

  static Future<void> init() async {
    await Hive.initFlutter();
    
    // Register Adapters
    Hive.registerAdapter(ProjectAdapter());
    Hive.registerAdapter(EvidenceAdapter());
    Hive.registerAdapter(SyncItemAdapter());
    Hive.registerAdapter(SyncOperationAdapter());

    // Open Boxes
    await Hive.openBox<Project>(projectsBoxName);
    await Hive.openBox<Evidence>(evidencesBoxName);
    await Hive.openBox<SyncItem>(syncBoxName);
  }

  // Generic Save with Sync Queue injection
  static Future<void> saveProject(Project project) async {
    final box = Hive.box<Project>(projectsBoxName);
    await box.put(project.id, project);
    
    // Add to sync queue for future cloud integration
    final syncBox = Hive.box<SyncItem>(syncBoxName);
    await syncBox.add(SyncItem(
      entityType: 'project',
      entityId: project.id,
      operation: SyncOperation.create,
      timestamp: DateTime.now(),
    ));
  }
}
