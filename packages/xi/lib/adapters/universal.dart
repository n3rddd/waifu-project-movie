import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:dart_qjson/dart_qjson.dart';
import 'package:xi/xi.dart';

const kEvalTimeout = Duration(seconds: 6);

var kJSEmptyException = Exception("JS 代码为空");

extension BetterJSONList on JsonList {
  void forEach(ValueChanged<JsonObject> cb) {
    for (var i = 0; i < length; i++) {
      JsonObject cx = getObject(i)!;
      cb(cx);
    }
  }

  List<T> map<T>(T Function(JsonObject value) cb) {
    List<T> result = [];
    forEach((item) {
      result.add(cb(item));
    });
    return result;
  }
}

enum JSCodeType {
  category,
  home,
  search,
  detail,
  parseIframe,
}

class UniversalSpider extends ISpiderAdapter {
  UniversalSpider(SourceMeta sourceMeta) {
    meta = sourceMeta;
  }

  String get url => meta.api;

  List<SourceSpiderQueryCategory> parseCategoryWithJSResult(String _result) {
    var jsonList = JsonList.fromJsonString(_result);
    List<SourceSpiderQueryCategory> result = [];
    jsonList.forEach((item) {
      var text = item.get("text").toString();
      var id = item.get("id").toString();
      result.add(SourceSpiderQueryCategory(text, id));
    });
    return result;
  }

  List<VideoDetail> parseListWithJSResult(String _result) {
    var jsonList = JsonList.fromJsonString(_result);
    List<VideoDetail> result = [];
    jsonList.forEach((item) {
      var cover = item.get("cover").toString();
      var title = item.get("title").toString();
      var desc = "";
      {
        var _desc = item.get("desc");
        if (_desc != null && _desc.isString) {
          desc = _desc.toString();
        }
      }
      var id = item.get("id").toString();
      var remark = item.get("remark").toString();
      var playlist = item.getList("playlist");
      List<Videos> realVideos = [];
      if (playlist != null && playlist.isNotEmpty) {
        var videoInfos = playlist.map((item) {
          var name = item.get("text").toString();
          var _id = item.get("id");
          var _url = item.get("url");
          late VideoType type;
          late String url;
          if (_url != null && _url.isString) {
            type = VideoType.m3u8;
            url = _url.toString();
          } else {
            type = VideoType.iframe;
            if (_id == null) {
              url = "";
            } else {
              url = _id.toString();
            }
          }
          return VideoInfo(
            name: name,
            url: url,
            type: type,
          );
        }).toList();
        realVideos.add(
          Videos(
            title: "默认",
            datas: videoInfos,
          ),
        );
      }
      result.add(
        VideoDetail(
          id: id,
          title: title,
          desc: desc,
          remark: remark,
          extra: {},
          videos: realVideos,
          smallCoverImage: cover,
        ),
      );
    });
    return result;
  }

  Map<String, dynamic> get _jsMap => meta.extra['js'] ?? {};

  String _generateJSCode(String realCode, {Map<String, dynamic>? params}) {
    var ps = jsonEncode(params ?? {});
    var result = """
(async ()=> {
  const env = {
    get(key, defaultValue) {
      return this.params[key] ?? defaultValue
    },
    baseUrl: `$url`,
    params: $ps,
  };
  $realCode
})()""";
    return result;
  }

  String _getLogicJSCode(JSCodeType type) {
    return _jsMap[type.name] ?? "";
  }

  String _realCode(JSCodeType type, {Map<String, dynamic>? params}) {
    var logic = _getLogicJSCode(type);
    if (logic.isEmpty) return "";
    return _generateJSCode(logic, params: params);
  }

  @override
  Future<List<SourceSpiderQueryCategory>> getCategory() async {
    var cates = _getLogicJSCode(JSCodeType.category);
    if (cates.isEmpty) return [];
    if (getJSONBodyType(cates) == JSONBodyType.array) {
      var result = JsonList.fromJsonString(cates).map((item) {
        return SourceSpiderQueryCategory(
          item.get("text").toString(),
          item.get("id").toString(),
        );
      });
      return result;
    }
    var code = _generateJSCode(cates);
    var result = await js2.evalSync(code, timeout: kEvalTimeout);
    return parseCategoryWithJSResult(result);
  }

  @override
  Future<List<VideoDetail>> getHome({
    int page = 1,
    int limit = 10,
    String? category,
  }) async {
    var code = _realCode(JSCodeType.home, params: {
      "category": category,
      "page": page,
      "limit": limit,
    });
    if (code.isEmpty) throw kJSEmptyException;
    var result = await js2.evalSync(code, timeout: kEvalTimeout);
    return parseListWithJSResult(result);
  }

  @override
  Future<VideoDetail> getDetail(String movieId) async {
    var code = _realCode(JSCodeType.detail, params: {
      "movieId": movieId,
    });
    if (code.isEmpty) throw kJSEmptyException;
    var result = await js2.evalSync(code, timeout: kEvalTimeout);
    return parseListWithJSResult(result)[0];
  }

  @override
  Future<List<VideoDetail>> getSearch({
    required String keyword,
    int page = 1,
    int limit = 10,
  }) async {
    var code = _realCode(JSCodeType.search, params: {
      "page": page,
      "limit": limit,
      "keyword": keyword,
    });
    if (code.isEmpty) [];
    var result = await js2.evalSync(code, timeout: kEvalTimeout);
    return parseListWithJSResult(result);
  }

  @override
  bool get isNsfw => meta.isNsfw;

  @override
  Future<List<String>> parseIframe(String iframe) async {
    var code = _realCode(JSCodeType.parseIframe, params: {
      "iframe": iframe,
    });
    if (code.isEmpty) return [];
    var result = await js2.evalSync(code, timeout: kEvalTimeout);
    // 返回的貌似是 '"xx.m3u8"'
    // 所以可能还需要在解析一下
    String realResult = jsonDecode(result);
    return [realResult];
  }
}
