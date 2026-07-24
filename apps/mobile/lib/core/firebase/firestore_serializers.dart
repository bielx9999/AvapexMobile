import 'package:cloud_firestore/cloud_firestore.dart';

DateTime readDateTime(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value is Timestamp) {
    return value.toDate();
  }
  if (value is DateTime) {
    return value;
  }
  if (value is String) {
    return DateTime.parse(value);
  }
  throw FormatException('Invalid timestamp field "$field": $value');
}

DateTime? readNullableDateTime(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value == null) {
    return null;
  }
  if (value is Timestamp) {
    return value.toDate();
  }
  if (value is DateTime) {
    return value;
  }
  if (value is String) {
    return DateTime.parse(value);
  }
  throw FormatException('Invalid nullable timestamp field "$field": $value');
}

List<String> readStringList(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value == null) {
    return const [];
  }
  if (value is Iterable) {
    return value.map((item) => item.toString()).toList(growable: false);
  }
  throw FormatException('Invalid string list field "$field": $value');
}

Map<String, dynamic> readMap(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  throw FormatException('Invalid map field "$field": $value');
}

Timestamp writeTimestamp(DateTime value) => Timestamp.fromDate(value);

Timestamp? writeNullableTimestamp(DateTime? value) {
  if (value == null) {
    return null;
  }
  return Timestamp.fromDate(value);
}
