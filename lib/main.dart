import 'package:flutter/material.dart';
import 'core/storage/hive_service.dart';
import 'modules/projects/models/project.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Hive
  await HiveService.init();
  
  runApp(const FieldTraceApp());
}

class FieldTraceApp extends StatelessWidget {
  const FieldTraceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Field Trace',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.light,
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      home: const Center(child: Text("Field Trace Architecture Locked")),
    );
  }
}
