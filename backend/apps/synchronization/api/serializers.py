from rest_framework import serializers


class SyncOperationSerializer(serializers.Serializer):
    operationId = serializers.UUIDField()
    entityType = serializers.ChoiceField(
        choices=["EXPENSE", "INCOME", "CATEGORY", "BUDGET", "RECURRING"]
    )
    entityId = serializers.UUIDField()
    operation = serializers.ChoiceField(choices=["CREATE", "UPDATE", "DELETE"])
    baseVersion = serializers.IntegerField(default=0, min_value=0)
    payload = serializers.DictField(required=False, default=dict)


class SyncRequestSerializer(serializers.Serializer):
    deviceId = serializers.UUIDField()
    sinceSequence = serializers.IntegerField(default=0, min_value=0)
    operations = serializers.ListField(
        child=SyncOperationSerializer(),
        required=False,
        default=list,
    )


class ProcessedOperationSerializer(serializers.Serializer):
    operationId = serializers.UUIDField()
    entityId = serializers.UUIDField()
    status = serializers.ChoiceField(choices=["ACCEPTED", "CONFLICT", "REJECTED"])
    serverVersion = serializers.IntegerField()
    serverSequence = serializers.IntegerField()
    reason = serializers.CharField(required=False, allow_null=True)


class TombstoneSerializer(serializers.Serializer):
    entityType = serializers.CharField()
    entityId = serializers.UUIDField()
    serverSequence = serializers.IntegerField()
    deletedAt = serializers.DateTimeField()


class SyncResponseSerializer(serializers.Serializer):
    processedOperations = serializers.ListField(child=ProcessedOperationSerializer())
    serverChanges = serializers.DictField()
    latestServerSequence = serializers.IntegerField()
    hasMore = serializers.BooleanField(default=False)
